/**
 * SigilOS Discord Gateway Bot
 * 
 * Handles Discord guild and member lifecycle events via WebSocket Gateway.
 * Automatically syncs guild whitelist and member profiles with the database.
 * 
 * Events handled:
 * - GUILD_CREATE: Bot added to server → Auto-whitelist in AllowedGuild
 * - GUILD_DELETE: Bot removed → Soft-delete GuildConfig + archive profiles
 * - GUILD_MEMBER_REMOVE: Member left/kicked → Archive UserProfile (12 mois, BANNED si ban)
 * - GUILD_BAN_ADD: Ban manuel ou bot tiers → ACTIVE/ARCHIVED vers BANNED
 */

import { 
    Client, 
    GatewayIntentBits, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    Partials,
    AuditLogEvent,
    Guild
} from 'discord.js';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// SECURITY FIX (F-23): Use the canonical DATABASE_URL env var like the rest of the
// app (docker-compose provides it). The previous code reassembled the connection
// string from fragments using a 'post'+'gresql://' trick that only served to hide
// the real password from secret scanners — a bad practice that masks genuine leaks.
const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
    console.error('[Discord Bot] ❌ Missing DATABASE_URL environment variable');
    process.exit(1);
}

// 🛡️ Fail-fast : valide que l'URL est bien formée dès le démarrage.
// Sans cela, le bot tourne "à l'aveugle" et échoue en silence à CHAQUE écriture BDD
// (ex: DATABASE_URL reconstruite cassée dans docker-compose → "Invalid URL").
// Voir src/temp/prompt-next-chantier-ladder-discord.md (cause racine du bug Ladder Discord).
try {
    const parsed = new URL(datasourceUrl);
    if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
        throw new Error(`URL mal formée (hostname ou base manquants)`);
    }
} catch (e) {
    console.error(`[Discord Bot] ❌ DATABASE_URL invalide → crash volontaire (fail-fast). Détail :`, e instanceof Error ? e.message : e);
    console.error(`[Discord Bot]    Vérifiez la valeur dans l'environnement du conteneur.`);
    process.exit(1);
}

// Prisma 7.x avec driverAdapters requiert un adapter explicite (datasources et datasourceUrl sont bannis)
const adapter = new PrismaPg({ connectionString: datasourceUrl });
const db = new PrismaClient({ adapter });

/**
 * #223 — Nom de salon sûr pour les logs (obfuscation Gateway) :
 * ne jamais afficher `___hidden___`. Un salon obfusqué = « Salon masqué ».
 */
function safeChannelLabel(name: string | null | undefined): string {
    return !name || name === "___hidden___" ? "Salon masqué" : name;
}

type GuildExecutor = { id: string; tag: string; isBot: boolean };

/**
 * Exécutant réel d'une action Discord (staff, membre lui-même, bot tiers).
 * Lit le journal d'audit du serveur. THROW en cas d'erreur technique (permission
 * « Voir le journal d'audit » manquante, réseau) pour que l'appelant distingue
 * « vérifié, personne » (null) de « vérification impossible » (throw).
 * Fenêtre courte (10 min) : l'event vient de se produire, sinon on ne conclut pas.
 */
async function findGuildExecutor(
    guild: Guild,
    type: AuditLogEvent,
    targetId: string,
    maxAgeMs = 10 * 60 * 1000
): Promise<GuildExecutor | null> {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const entry = logs.entries.find((e) => {
        const t = e.target as unknown as { id?: string } | null;
        return t?.id === targetId;
    });
    if (!entry?.executor) return null;
    if (Date.now() - entry.createdTimestamp > maxAgeMs) return null;
    const ex = entry.executor;
    return { id: ex.id, tag: (ex as { tag?: string | null }).tag ?? ex.username ?? "Membre Discord", isBot: !!ex.bot };
}

/** Champs `metadata` d'audit pour tracer l'exécutant (même forme que les syncs). */
function executorMeta(ex: GuildExecutor | null, targetId: string) {
    if (!ex) return {};
    const meta: { executorId: string; executorTag: string; executorIsBot?: boolean; executorIsSelf?: boolean } = {
        executorId: ex.id,
        executorTag: ex.tag,
    };
    if (ex.isBot) meta.executorIsBot = true;
    if (ex.id === targetId) meta.executorIsSelf = true;
    return meta;
}

// #223 P2 — Intents privilégiés (doc stabilité long terme) :
//  - GuildMembers : synchro des membres (GuildMemberAdd/Remove/Update) + roster.
//  - MessageContent : suivi des messages (Ladder Discord) + contenu des embeds
//    (blacklist #85). Activation : 2026 — réexamen / re-apply annuel requis
//    au-delà de 10 000 utilisateurs (review Discord).
//  - GuildMessageTyping : retiré (F-24, least privilege — pas besoin de lire
//    les frappes clavier).
const client = new Client({
        intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        // SECURITY FIX (F-24): GuildMessageTyping removed — least privilege.
        // The bot must not need the right to read every keystroke/typing event.
        // #1 validé : GuildModeration (non-privilégié) requis pour GuildBanAdd/Remove
        // (ban manuel ou via bot tiers, y compris après un départ).
    ],
    // Partials.GuildMember : indispensable pour que GuildMemberRemove fire
    // même pour les membres qui n'étaient pas dans le cache (bot redémarré).
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

// ========================
// Event: Bot Ready
// ========================
client.once(Events.ClientReady, (readyClient) => {
    console.log(`[Discord Bot] ✅ Logged in as ${readyClient.user.tag}`);
    console.log(`[Discord Bot] 🌐 Serving ${readyClient.guilds.cache.size} guilds`);

    // Scan all channels to populate voiceSessions and streamSessions for currently connected users
    const now = Date.now();
    let prePopulatedCount = 0;
    let prePopulatedStreamCount = 0;
    readyClient.guilds.cache.forEach(guild => {
        guild.channels.cache.forEach(channel => {
            if (channel.isVoiceBased()) {
                channel.members.forEach(member => {
                    if (!member.user.bot) {
                        voiceSessions.set(member.id, now);
                        prePopulatedCount++;

                        if (member.voice.streaming) {
                            streamSessions.set(member.id, now);
                            prePopulatedStreamCount++;
                        }
                    }
                });
            }
        });
    });
    if (prePopulatedCount > 0) {
        console.log(`[Discord Bot] 🎙️ Pre-populated voice session for ${prePopulatedCount} members active in voice channels (${prePopulatedStreamCount} streaming)`);
    }

    // #223 — Observabilité obfuscation des salons (toggle portail / 16/11/2026) :
    // compte les salons masqués (name "___hidden___" ou flag CHANNEL_OBFUSCATED 1<<17) par guilde.
    readyClient.guilds.cache.forEach(guild => {
        const obfuscatedCount = guild.channels.cache.filter(ch =>
            ch.name === "___hidden___" || (((ch as { flags?: { bitfield?: number } }).flags?.bitfield ?? 0) & (1 << 17)) !== 0
        ).size;
        if (obfuscatedCount > 0) {
            console.log(`[Discord Bot] 🔒 ${obfuscatedCount} salon(s) obfusqué(s) masqué(s) sur ${guild.name} (${guild.id})`);
        }
    });
});

// ========================
// Event: Guild Create (Bot Added)
// ========================
client.on(Events.GuildCreate, async (guild) => {
    console.log(`[Discord Bot] ➕ Guild added: ${guild.name} (${guild.id})`);

    try {
        // Check if already whitelisted
        const existing = await db.allowedGuild.findUnique({
            where: { discordGuildId: guild.id },
        });

        if (!existing) {
            // Modèle A (acquisition ouverte) : le bot rejoint = guilde déployable
            // immédiatement, sans validation humaine. Le kill-switch God
            // (PlatformConfig.autoOnboardingEnabled=false) repose sur le portail
            // (la guilde n'apparaît pas en pending) — ce handler reste permissif
            // par construction, la gate étant côté portail + onboardGuild.
            // Le staff garde ban / gel / expulsion a posteriori (+ notif ci-dessous).
            const platformCfg = await (db as any).platformConfig.findUnique({
                where: { id: "singleton" },
                select: { autoOnboardingEnabled: true },
            }).catch(() => null);
            const autoOnboardingOn = platformCfg?.autoOnboardingEnabled !== false;
            await db.allowedGuild.create({
                data: {
                    discordGuildId: guild.id,
                    name: guild.name,
                    tier: 'BETA',
                    isActive: autoOnboardingOn,
                    addedBy: 'SYSTEM_GATEWAY',
                    notes: autoOnboardingOn
                        ? `Auto-déployable via Gateway bot on ${new Date().toISOString()}.`
                        : `Auto-detected via Gateway bot on ${new Date().toISOString()} (auto-onboarding OFF — activation God requise).`,
                },
            });

            console.log(`[Discord Bot] ✅ Auto-whitelisted: ${guild.name} (active=${autoOnboardingOn})`);

            // 🔔 NOTIFY GOD — Nouveau serveur détecté (info ; action seulement si abus)
            try {
                // 1. Create DB notification
                await (db as any).godNotification.create({
                    data: {
                        title: autoOnboardingOn ? "🟢 Nouveau serveur (auto-actif)" : "🚨 Nouveau serveur non-whitelisté",
                        message: autoOnboardingOn
                            ? `Le bot a été invité sur **"${guild.name}"** (\`${guild.id}\`) — actif immédiatement (modèle ouvert). Ban/gel possibles depuis le GOD Dashboard en cas d'abus.`
                            : `Le bot a été invité sur **"${guild.name}"** (\`${guild.id}\`) qui n'est pas dans la whitelist.\nAction requise : approuver ou rejeter depuis le GOD Dashboard.`,
                        type: "SYSTEM",
                        success: autoOnboardingOn,
                        metadata: {
                            discordGuildId: guild.id,
                            guildName: guild.name,
                            addedBy: 'SYSTEM_GATEWAY',
                            operation: 'GUILD_CREATE_UNWHITELISTED'
                        },
                    },
                });

                // 2. Try to send Discord alert to GOD channel
                const platformConfig = await (db as any).platformConfig.findUnique({ where: { id: "singleton" } });
                const godChannelId = platformConfig?.godNotifyChannelId;
                if (godChannelId) {
                    const channel = await client.channels.fetch(godChannelId).catch(() => null);
                    if (channel && channel.isTextBased() && 'send' in channel) {
                        await channel.send({
                            embeds: [{
                                title: '🚨 Nouveau serveur non-whitelisté',
                                description: `Le bot a été invité sur **"${guild.name}"** (\`${guild.id}\`)\n\n⚠️ Ce serveur n'est **pas dans la whitelist**. Rendez-vous sur le GOD Dashboard pour approuver ou rejeter.`,
                                color: 0xef4444,
                                fields: [
                                    { name: 'Serveur', value: guild.name, inline: true },
                                    { name: 'ID', value: guild.id, inline: true },
                                ],
                                timestamp: new Date().toISOString(),
                                footer: { text: 'SigilOS Gateway Bot • Sécurité' },
                            }]
                        }).catch((e: unknown) => console.error('[GodNotify] Failed to send Discord alert:', e));
                    }
                }
            } catch (godErr) {
                console.error('[GodNotify] Failed to notify GOD:', godErr);
            }
        } else {
            console.log(`[Discord Bot] Guild ${guild.name} already whitelisted — sending welcome embed anyway`);
        }

        // Log audit
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guild.id },
            select: { id: true },
        });

        if (guildConfig) {
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Bot SigilOS',
                    action: 'WEBHOOK_GUILD_CREATE',
                    targetType: 'GUILD',
                    targetId: guildConfig.id,
                    oldValue: {},
                    newValue: { whitelisted: true, tier: 'BETA' },
                    metadata: { discordGuildId: guild.id, guildName: guild.name },
                },
            });
        }

        console.log(`[Discord Bot] ✅ Auto-whitelisted: ${guild.name}`);

        // ========================
        // WELCOME ONBOARDING EMBED
        // ========================
        try {
            // 1. Fetch ALL channels first — cache is empty on guildCreate (bot just joined)
            await guild.channels.fetch();

            // 2. Find the best channel (System channel or first chatty channel)
            const targetChannel = guild.systemChannel || guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && 
                guild.members.me?.permissionsIn(c).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
            );

            if (targetChannel && targetChannel.isTextBased()) {
                // Verify we can actually send messages by checking bot member permissions
                const botMember = guild.members.me;
                const canSend = targetChannel.isTextBased() && botMember?.permissionsIn(targetChannel.id).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]);

                if (!canSend) {
                    console.log(`[Discord Bot] Cannot send welcome embed to ${safeChannelLabel(targetChannel.name)} in ${guild.name} — missing permissions`);
                    return;
                }
                const baseUrl = (process.env.SIGILOS_BASE_URL || "https://beta.sigilos.fr").replace(/\/$/, "");
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('🏰 SigilOS est arrivé sur votre serveur')
                    .setDescription("Le bot est installé. L'admin du serveur peut activer la guilde en 1 minute.")
                    .setColor(0x10b981)
                    .addFields(
                        {
                            name: 'Étape 1 — Se connecter',
                            value: `Rendez-vous sur **[le dashboard](${baseUrl}/dashboard)** et connectez-vous avec votre compte Discord (le compte administrateur du serveur).`,
                            inline: false,
                        },
                        {
                            name: 'Étape 2 — Déployer',
                            value: 'Sur le portail, votre serveur apparaît dans **« Déploiement »** : cliquez sur **"Déployer"** (ou laissez l\'activation automatique faire son office).\nCela crée votre guilde dans SigilOS et déverrouille le panneau d\'administration.',
                            inline: false,
                        },
                        {
                            name: 'Étape 3 — Configurer les accès',
                            value: 'Depuis le panneau **Supervision** de votre guilde, associez vos rôles Discord aux permissions SigilOS (qui peut valider des missions, accéder au ladder, etc.).',
                            inline: false,
                        }
                    )
                    .setFooter({ text: 'SigilOS · Beta — Si problème, contactez le staff via le dashboard.' })
                    .setTimestamp();

                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Ouvrir le Dashboard')
                            .setURL(`${baseUrl}/dashboard`)
                            .setStyle(ButtonStyle.Link)
                    );

                await targetChannel.send({ embeds: [welcomeEmbed], components: [row as any] });
                console.log(`[Discord Bot] ✉️ Welcome message sent to ${safeChannelLabel(targetChannel.name)} in ${guild.name}`);
            }
        } catch (msgErr) {
            console.error(`[Discord Bot] Failed to send welcome message:`, msgErr);
        }
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_CREATE:`, error);
    }
});

/**
 * Succession du propriétaire SigilOS au départ Discord (leave/kick, pas seulement
 * purge/archive/ban — voir handleGuildOwnerSuccession côté web).
 * Priorité 1 : owner Discord live avec profil ACTIF. Priorité 2 : membre ACTIF
 * le plus ancien (hors partant). Écrit TOUJOURS un UUID interne (normalise les
 * ownerId snowflakes hérités de l'onboarding). Échec silencieux (log) : le filet
 * P2 (cron orphelin) + le God prennent le relais. Jamais d'auto-élévation
 * hors de ces deux règles.
 */
async function maybeSuccessionOnLeave(
    guildInternalId: string,
    guildName: string,
    discordGuildId: string,
    leaverDiscordId: string,
    leaverUserId: string | null,
    liveDiscordOwnerId: string | null,
): Promise<void> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { id: guildInternalId },
            select: { id: true, ownerId: true, lifecycleNotifyChannelId: true, systemNotifyChannelId: true },
        });
        if (!guildConfig?.ownerId) return;
        const storedOwner = guildConfig.ownerId as string;
        const leaverIsOwner =
            storedOwner === leaverUserId || (leaverDiscordId && storedOwner === leaverDiscordId);
        if (!leaverIsOwner) {
            // Normalisation paresseuse : snowflake résolvable → UUID interne.
            if (/^\d{17,20}$/.test(storedOwner)) {
                const ownerAccount = await db.account.findFirst({
                    where: { provider: 'discord', providerAccountId: storedOwner },
                    select: { userId: true },
                });
                if (ownerAccount?.userId) {
                    const ownerProfile = await db.userProfile.findFirst({
                        where: { userId: ownerAccount.userId, guildId: guildInternalId, status: 'ACTIVE' },
                        select: { id: true },
                    });
                    if (ownerProfile) {
                        await db.guildConfig.update({
                            where: { id: guildInternalId },
                            data: { ownerId: ownerAccount.userId },
                        });
                    }
                }
            }
            return;
        }

        let newOwnerUserId: string | null = null;
        let newOwnerName = 'Membre';
        let successionReason = 'AUTOMATIC_SUCCESSION';

        // Priorité 1 : owner Discord live avec profil ACTIF
        if (liveDiscordOwnerId && liveDiscordOwnerId !== leaverDiscordId) {
            const discordOwnerAccount = await db.account.findFirst({
                where: { provider: 'discord', providerAccountId: liveDiscordOwnerId },
                select: { userId: true },
            });
            if (discordOwnerAccount?.userId) {
                const discordOwnerProfile = await db.userProfile.findFirst({
                    where: { userId: discordOwnerAccount.userId, guildId: guildInternalId, status: 'ACTIVE' },
                    select: { userId: true, pseudoDofus: true, discordNickname: true },
                });
                if (discordOwnerProfile) {
                    newOwnerUserId = discordOwnerProfile.userId;
                    newOwnerName = discordOwnerProfile.pseudoDofus || discordOwnerProfile.discordNickname || 'Discord Owner';
                    successionReason = 'DISCORD_SERVER_OWNER_INHERITANCE';
                }
            }
        }

        // Priorité 2 : membre ACTIF le plus ancien (hors partant)
        if (!newOwnerUserId) {
            const senior = await db.userProfile.findFirst({
                where: {
                    guildId: guildInternalId,
                    status: 'ACTIVE',
                    userId: { not: leaverUserId || undefined },
                },
                orderBy: { createdAt: 'asc' },
                select: { userId: true, pseudoDofus: true, discordNickname: true },
            });
            if (senior) {
                newOwnerUserId = senior.userId;
                newOwnerName = senior.pseudoDofus || senior.discordNickname || 'Senior Member';
                successionReason = 'SENIOR_MEMBER_SUCCESSION';
            }
        }

        if (!newOwnerUserId) {
            console.log(`[GuildSuccession] ⚠️ Aucun successeur pour ${guildName} — filet orphelin (cron/P2).`);
            return;
        }

        await db.guildConfig.update({
            where: { id: guildInternalId },
            data: { ownerId: newOwnerUserId },
        });
        await (db as any).auditLog.create({
            data: {
                guildId: guildInternalId,
                actorUserId: 'SYSTEM',
                actorName: 'Succession Automatique (départ Discord)',
                action: 'GUILD_CONFIG_UPDATED',
                targetType: 'GUILD',
                targetId: guildInternalId,
                metadata: { actionDetail: 'AUTOMATIC_OWNERSHIP_SUCCESSION', reason: successionReason, previousOwnerId: storedOwner, newOwnerId: newOwnerUserId, newOwnerName },
            },
        }).catch((e: unknown) => console.error('[GuildSuccession] audit failed:', e));
        await (db as any).godNotification.create({
            data: {
                title: '🛡️ Succession Automatique Effectuée',
                message: `Guilde: **${guildName}**\nNouveau propriétaire: **${newOwnerName}**\nMotif: **${successionReason}** (départ Discord de l'ancien owner)`,
                type: 'SYSTEM',
                success: true,
                metadata: { guildId: guildInternalId, newOwnerUserId, successionReason },
            },
        }).catch((e: unknown) => console.error('[GuildSuccession] god notif failed:', e));

        const staffChannelId = guildConfig.lifecycleNotifyChannelId || guildConfig.systemNotifyChannelId;
        if (staffChannelId) {
            const channel = await client.channels.fetch(staffChannelId).catch(() => null);
            if (channel && channel.isTextBased() && 'send' in channel) {
                await channel.send({
                    embeds: [{
                        title: '🛡️ Succession Automatique de Propriété',
                        description: `L'ancien propriétaire a quitté Discord : la propriété de **${guildName}** a été transmise à **${newOwnerName}**.\n\n📋 Motif : ${successionReason === 'DISCORD_SERVER_OWNER_INHERITANCE' ? "Propriétaire légitime du serveur Discord" : "Membre actif le plus ancien"}`,
                        color: 0x3b82f6,
                        timestamp: new Date().toISOString(),
                        footer: { text: 'SigilOS • Fail-Safe Protection' },
                    }],
                }).catch((e: unknown) => console.error('[GuildSuccession] staff alert failed:', e));
            }
        }
        console.log(`[GuildSuccession] ✅ ${guildName} → ${newOwnerName} (${successionReason})`);
    } catch (e) {
        console.error('[GuildSuccession] succession on leave failed:', e);
    }
}

// ========================
// Event: Guild Delete (Bot Removed)
// ========================
client.on(Events.GuildDelete, async (guild) => {
    console.log(`[Discord Bot] ➖ Guild removed: ${guild.name} (${guild.id})`);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guild.id },
            select: { id: true, name: true },
        });

        if (!guildConfig) {
            console.log(`[Discord Bot] Guild ${guild.id} not in database, ignoring`);
            return;
        }

        // Soft-delete guild
        const scheduledDeletion = new Date();
        scheduledDeletion.setDate(scheduledDeletion.getDate() + 30); // 30 days grace

        await db.guildConfig.update({
            where: { id: guildConfig.id },
            data: {
                isActive: false,
                deletedAt: new Date(),
                deletionReason: 'BOT_REMOVED',
                scheduledDeletion,
            },
        });

        // Archive all profiles
        await db.userProfile.updateMany({
            where: { guildId: guildConfig.id },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archiveReason: 'GUILD_DELETED',
                scheduledDeletion,
            },
        });

        // Log audit
        await db.auditLog.create({
            data: {
                guildId: guildConfig.id,
                actorUserId: 'SYSTEM',
                actorName: 'Bot SigilOS',
                action: 'WEBHOOK_GUILD_DELETE',
                targetType: 'GUILD',
                targetId: guildConfig.id,
                oldValue: { isActive: true },
                newValue: { isActive: false, deletionReason: 'BOT_REMOVED' },
                metadata: { discordGuildId: guild.id },
            },
        });

        console.log(`[Discord Bot] 🗑️ Soft-deleted guild: ${guildConfig.name}`);
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_DELETE:`, error);
    }
});

// ========================
// Event: Member Add (Reactivation)
// ========================
client.on(Events.GuildMemberAdd, async (member) => {
    const serverNickname = member.nickname || member.displayName || member.user.displayName || member.user.username;
    console.log(`[Discord Bot] 👤 Member joined: ${serverNickname} (${member.user.tag}) in ${member.guild.name}`);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: member.guild.id },
            select: { id: true },
        });

        if (!guildConfig) return;

        // Find user account
        const account = await db.account.findFirst({
            where: {
                provider: 'discord',
                providerAccountId: member.user.id,
            },
            select: { userId: true },
        });

        if (!account) return;

        // Find profile
        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: account.userId,
                    guildId: guildConfig.id,
                }
            }
        });

        // ONLY reactivate if ARCHIVED. Never touch BANNED.
        if (profile && profile.status === 'ARCHIVED') {
            await db.userProfile.update({
                where: { id: profile.id },
                data: {
                    status: 'ACTIVE',
                    archivedAt: null,
                    archiveReason: null,
                    scheduledDeletion: null, // Cancel any pending hard delete
                    discordNickname: member.nickname || member.user.username,
                },
            });

            // Log audit
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Bot SigilOS',
                    action: 'WEBHOOK_MEMBER_ADD',
                    targetType: 'PROFILE',
                    targetId: member.user.id,
                    oldValue: { status: 'ARCHIVED' },
                    newValue: { status: 'ACTIVE' },
                    metadata: {
                        discordUserId: member.user.id,
                        username: member.user.tag,
                        serverNickname,
                        changeDetail: 'Arrivée sur le serveur Discord',
                        reason: 'Nouveau membre / Réintégration',
                    },
                },
            });

            console.log(`[Discord Bot] ✅ Reactivated profile for ${serverNickname} (${member.user.tag})`);
        }
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_MEMBER_ADD:`, error);
    }
});

// ========================
// Event: Member Remove
// ========================
client.on(Events.GuildMemberRemove, async (member) => {
    const serverNickname = member.nickname || member.displayName || member.user.displayName || member.user.username;
    console.log(`[Discord Bot] 👤 Member left: ${serverNickname} (${member.user.tag}) from ${member.guild.name}`);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: member.guild.id },
            select: { id: true },
        });

        if (!guildConfig) return;

        // Find user account (peut être absent : owner snowflake sans profil SigilOS)
        const account = await db.account.findFirst({
            where: {
                provider: 'discord',
                providerAccountId: member.user.id,
            },
            select: { userId: true },
        });

        // P0 — succession AVANT tout return : même sans profil, le partant peut
        // être l'owner stocké (snowflake d'onboarding). Vérification cheap.
        const liveOwner = await member.guild.fetchOwner().then(o => o.id).catch(() => member.guild.ownerId ?? null);
        const ownerCheck = await db.guildConfig.findUnique({
            where: { id: guildConfig.id },
            select: { ownerId: true },
        });
        if (ownerCheck?.ownerId && (ownerCheck.ownerId === member.user.id || (account && ownerCheck.ownerId === account.userId))) {
            await maybeSuccessionOnLeave(
                guildConfig.id,
                member.guild.name,
                member.guild.id,
                member.user.id,
                account?.userId ?? null,
                liveOwner,
            );
        }

        if (!account) return;

        // #1 validé : un ban direct émet aussi GuildMemberRemove → ne pas le
        // classer LEFT. Check best-effort de la ban-list (échec = on reste en LEFT,
        // GuildBanAdd + sync corrigeront en BANNED).
        let isBan = false;
        try {
            await member.guild.bans.fetch(member.user.id);
            isBan = true;
        } catch {
            isBan = false;
        }

        if (isBan) {
            const twelveMonths = new Date();
            twelveMonths.setFullYear(twelveMonths.getFullYear() + 1);
            await db.userProfile.updateMany({
                where: {
                    userId: account.userId,
                    guildId: guildConfig.id,
                    status: { in: ['ACTIVE', 'ARCHIVED'] },
                },
                data: {
                    status: 'BANNED',
                    archivedAt: new Date(),
                    archiveReason: 'BANNED',
                    scheduledDeletion: null,
                },
            });
            await db.guildMemberBan.upsert({
                where: { guildId_discordId: { guildId: guildConfig.id, discordId: member.user.id } },
                create: {
                    guildId: guildConfig.id,
                    discordId: member.user.id,
                    reason: 'Banni sur le serveur Discord',
                    bannedBy: 'SYSTEM',
                    bannedByName: 'Bot SigilOS',
                    memberName: serverNickname,
                },
                update: { reason: 'Banni sur le serveur Discord', liftedAt: null, liftedBy: null, liftedByName: null, memberName: serverNickname },
            }).catch(() => null);
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Bot SigilOS',
                    action: 'WEBHOOK_MEMBER_REMOVE',
                    targetType: 'PROFILE',
                    targetId: member.user.id,
                    oldValue: {},
                    newValue: { status: 'BANNED', archiveReason: 'BANNED' },
                    metadata: { discordUserId: member.user.id, username: member.user.tag, serverNickname, changeDetail: 'Ban Discord détecté au départ', reason: 'Banni sur Discord' },
                },
            }).catch(() => null);
            console.log(`[Discord Bot] ✅ Banned profile for ${serverNickname} (${member.user.tag})`);
            return;
        }

        // Archive profile (#6 validé : 12 mois, aligné sur le sync — plus 30 jours)
        const twelveMonthsFromNow = new Date();
        twelveMonthsFromNow.setFullYear(twelveMonthsFromNow.getFullYear() + 1);
        const result = await db.userProfile.updateMany({
            where: {
                userId: account.userId,
                guildId: guildConfig.id,
                status: 'ACTIVE',
            },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archiveReason: 'LEFT',
                scheduledDeletion: twelveMonthsFromNow,
            },
        });

        if (result.count > 0) {
            // Exécutant réel : exclusion par un staff/bot, ou départ volontaire.
            // « lui-même » uniquement si le journal a bien été lu (checked).
            let kickEx: GuildExecutor | null = null;
            let kickAuditChecked = false;
            try {
                kickEx = await findGuildExecutor(member.guild, AuditLogEvent.MemberKick, member.user.id);
                kickAuditChecked = true;
            } catch {
                kickAuditChecked = false;
            }
            // Log audit
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Bot SigilOS',
                    action: 'WEBHOOK_MEMBER_REMOVE',
                    targetType: 'PROFILE',
                    targetId: member.user.id,
                    oldValue: { status: 'ACTIVE' },
                    newValue: { status: 'ARCHIVED', archiveReason: 'LEFT' },
                    metadata: {
                        discordUserId: member.user.id,
                        username: member.user.tag,
                        serverNickname,
                        changeDetail: kickEx ? 'Retiré du serveur' : 'Départ du serveur Discord',
                        reason: kickEx ? 'Exclu du serveur' : 'A quitté le serveur',
                        ...(kickEx
                            ? executorMeta(kickEx, member.user.id)
                            : kickAuditChecked
                              ? { executorId: member.user.id, executorIsSelf: true as const }
                              : {}),
                    },
                },
            });

            // 🔔 Lifecycle notification — embed dans le canal configuré par l'admin
            try {
                const guildFull = await db.guildConfig.findUnique({
                    where: { id: guildConfig.id },
                    select: { lifecycleNotifyChannelId: true, name: true }
                });

                if (guildFull?.lifecycleNotifyChannelId) {
                    const channel = await client.channels.fetch(guildFull.lifecycleNotifyChannelId).catch(() => null);
                    if (channel && channel.isTextBased() && 'send' in channel) {
                        const displayName = serverNickname;
                        await channel.send({
                            embeds: [{
                                title: '📤 Membre Parti (Discord)',
                                description: `Le membre **${displayName}** a quitté le serveur Discord.`,
                                color: 0xf59e0b, // Amber
                                fields: [
                                    { name: 'Nom Discord', value: `@${member.nickname || member.user.displayName || member.user.username}`, inline: true },
                                    { name: 'Nouveau Statut', value: '**Archivé**', inline: true },
                                    { name: 'Action effectuée par', value: '🤖 SigilOS (automatique)', inline: false },
                                    { name: 'Rétention des données', value: 'Profil archivé 12 mois', inline: false },
                                    { name: 'Guilde', value: guildFull.name || member.guild.name, inline: false },
                                ],
                                thumbnail: { url: member.user.displayAvatarURL({ size: 128 }) },
                                footer: { text: `SigilOS · Lifecycle · ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}` },
                                timestamp: new Date().toISOString(),
                            }]
                        });
                    }
                }
            } catch (notifErr) {
                console.error('[Discord Bot] Failed to send lifecycle notification:', notifErr);
            }

            console.log(`[Discord Bot] ✅ Archived profile for ${serverNickname} (${member.user.tag})`);
        }
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_MEMBER_REMOVE:`, error);
    }
});

// ========================
// Event: Guild Ban Add (#1 validé — ban manuel ou via bot tiers,
// y compris APRÈS un départ : promotion ACTIVE/ARCHIVED → BANNED)
// ========================
client.on(Events.GuildBanAdd, async (ban) => {
    const bannedUser = ban.user;
    console.log(`[Discord Bot] 🔨 Ban: ${bannedUser.tag} (${bannedUser.id}) from ${ban.guild.name}`);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: ban.guild.id },
            select: { id: true },
        });
        if (!guildConfig) return;

        const account = await db.account.findFirst({
            where: { provider: 'discord', providerAccountId: bannedUser.id },
            select: { userId: true },
        });
        if (!account) return;

        const result = await db.userProfile.updateMany({
            where: {
                userId: account.userId,
                guildId: guildConfig.id,
                status: { in: ['ACTIVE', 'ARCHIVED'] },
            },
            data: {
                status: 'BANNED',
                archivedAt: new Date(),
                archiveReason: 'BANNED',
                scheduledDeletion: null,
            },
        });

        if (result.count > 0) {
            // Exécutant réel du ban (staff, ou bot tiers).
            const banEx = await findGuildExecutor(ban.guild, AuditLogEvent.MemberBanAdd, bannedUser.id).catch(() => null);
            await db.guildMemberBan.upsert({
                where: { guildId_discordId: { guildId: guildConfig.id, discordId: bannedUser.id } },
                create: {
                    guildId: guildConfig.id,
                    discordId: bannedUser.id,
                    reason: ban.reason ?? 'Banni sur le serveur Discord',
                    bannedBy: 'SYSTEM',
                    bannedByName: 'Bot SigilOS',
                    memberName: (bannedUser as { username?: string }).username ?? null,
                },
                update: { reason: ban.reason ?? 'Banni sur le serveur Discord', liftedAt: null, liftedBy: null, liftedByName: null },
            }).catch(() => null);

            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Bot SigilOS',
                    action: 'WEBHOOK_MEMBER_REMOVE',
                    targetType: 'PROFILE',
                    targetId: bannedUser.id,
                    oldValue: {},
                    newValue: { status: 'BANNED', archiveReason: 'BANNED' },
                    metadata: {
                        discordUserId: bannedUser.id,
                        username: bannedUser.tag,
                        changeDetail: 'Banni sur le serveur Discord',
                        reason: ban.reason ?? 'Banni sur Discord',
                        ...executorMeta(banEx, bannedUser.id),
                    },
                },
            }).catch(() => null);

            console.log(`[Discord Bot] ✅ Banned profile for ${bannedUser.tag} (GuildBanAdd)`);
        }
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_BAN_ADD:`, error);
    }
});

// ========================
// Event: Guild Ban Remove (déban Discord → ACTIVE direct, sans étape staff.
// Si le mec est déjà de retour sur le serveur : ACTIVE immédiat.
// Sinon (cas normal : unban ne ré-invite pas) : ARCHIVED/LEFT auto-réactivable,
// donc dès qu'il rejoint via invite, GuildMemberAdd le passe ACTIVE sans staff)
// ========================
client.on(Events.GuildBanRemove, async (ban) => {
    const unbannedUser = ban.user;
    console.log(`[Discord Bot] 🔓 Unban: ${unbannedUser.tag} (${unbannedUser.id}) from ${ban.guild.name}`);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: ban.guild.id },
            select: { id: true },
        });
        if (!guildConfig) return;

        const account = await db.account.findFirst({
            where: { provider: 'discord', providerAccountId: unbannedUser.id },
            select: { userId: true },
        });
        if (!account) return;

        // De retour sur le serveur ? (edge : unban + réinvite ultra rapide)
        const isBack = await ban.guild.members.fetch(unbannedUser.id).then(() => true).catch(() => false);

        const result = isBack
            ? await db.userProfile.updateMany({
                where: { userId: account.userId, guildId: guildConfig.id, status: 'BANNED' },
                data: { status: 'ACTIVE', archivedAt: null, archiveReason: null, scheduledDeletion: null },
            })
            : await db.userProfile.updateMany({
                where: { userId: account.userId, guildId: guildConfig.id, status: 'BANNED' },
                data: (() => {
                    const twelveMonths = new Date();
                    twelveMonths.setFullYear(twelveMonths.getFullYear() + 1);
                    return { status: 'ARCHIVED', archivedAt: new Date(), archiveReason: 'LEFT', scheduledDeletion: twelveMonths };
                })(),
            });

        if (result.count > 0) {
            // Exécutant réel du déban (staff, ou bot tiers).
            const unbanEx = await findGuildExecutor(ban.guild, AuditLogEvent.MemberBanRemove, unbannedUser.id).catch(() => null);
            await db.guildMemberBan.updateMany({
                where: { guildId: guildConfig.id, discordId: unbannedUser.id, liftedAt: null },
                data: { liftedAt: new Date(), liftedBy: 'SYSTEM', liftedByName: 'Bot SigilOS' },
            }).catch(() => null);

            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Bot SigilOS',
                    action: 'WEBHOOK_MEMBER_REMOVE',
                    targetType: 'PROFILE',
                    targetId: unbannedUser.id,
                    oldValue: { status: 'BANNED' },
                    newValue: isBack ? { status: 'ACTIVE' } : { status: 'ARCHIVED', archiveReason: 'LEFT' },
                    metadata: { discordUserId: unbannedUser.id, username: unbannedUser.tag, changeDetail: isBack ? 'De retour sur le serveur après son déban' : 'Débanni sur Discord — réactivé dès son retour sur le serveur', reason: 'Débanni sur Discord', ...executorMeta(unbanEx, unbannedUser.id) },
                },
            }).catch(() => null);

            console.log(`[Discord Bot] ✅ Unbanned profile for ${unbannedUser.tag} (→ ${isBack ? 'ACTIVE' : 'ARCHIVED auto'})`);
        }
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_BAN_REMOVE:`, error);
    }
});

// ========================
// Event: Member Update (Nicknames & Roles)
// ========================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const oldNick = oldMember.nickname || oldMember.displayName;
    const newNick = newMember.nickname || newMember.displayName;
    const nickChanged = oldMember.nickname !== newMember.nickname;

    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id) && r.id !== newMember.guild.id);
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id) && r.id !== newMember.guild.id);
    const rolesChanged = addedRoles.size > 0 || removedRoles.size > 0;

    if (!nickChanged && !rolesChanged) return;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: newMember.guild.id },
            select: { id: true },
        });

        if (!guildConfig) return;

        // Si le surnom a changé, mettre à jour le cache UserProfile
        if (nickChanged) {
            console.log(`[Discord Bot] ✏️ Nickname changed: ${newMember.user.tag} (${oldNick} -> ${newNick})`);

            await db.userProfile.updateMany({                where: {
                    user: {
                        accounts: {
                            some: {
                                provider: 'discord',
                                providerAccountId: newMember.user.id
                            }
                        }
                    },
                    guildId: guildConfig.id
                },
                data: { discordNickname: newMember.nickname || newMember.user.username }
            });

            // Log audit
            const nickEx = await findGuildExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.user.id).catch(() => null);
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Bot SigilOS',
                    action: 'WEBHOOK_MEMBER_UPDATE',
                    targetType: 'PROFILE',
                    targetId: newMember.user.id,
                    oldValue: { nickname: oldMember.nickname || null },
                    newValue: { nickname: newMember.nickname || null },
                    metadata: {
                        discordUserId: newMember.user.id,
                        type: 'NICKNAME_CHANGE',
                        username: newMember.user.tag,
                        serverNickname: newNick,
                        oldServerNickname: oldNick,
                        changeDetail: `Surnom serveur : "${oldNick}" ➔ "${newNick}"`,
                        reason: 'Modification de surnom sur le serveur Discord',
                        ...executorMeta(nickEx, newMember.user.id),
                    },
                },
            });
        }

        // Si les rôles ont changé, logguer la modification de rôles Discord
        if (rolesChanged) {
            const addedNames = addedRoles.map(r => r.name);
            const removedNames = removedRoles.map(r => r.name);
            const parts: string[] = [];
            if (addedNames.length > 0) parts.push(`+${addedNames.join(', +')}`);
            if (removedNames.length > 0) parts.push(`-${removedNames.join(', -')}`);
            const changeDetail = `Rôles Discord : ${parts.join(' | ')}`;

            console.log(`[Discord Bot] 🛡️ Roles changed for ${newNick} (${newMember.user.tag}): ${changeDetail}`);

            const rolesEx = await findGuildExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.user.id).catch(() => null);
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Bot SigilOS',
                    action: 'WEBHOOK_MEMBER_UPDATE',
                    targetType: 'PROFILE',
                    targetId: newMember.user.id,
                    oldValue: { roles: oldMember.roles.cache.filter(r => r.id !== newMember.guild.id).map(r => r.name) },
                    newValue: { roles: newMember.roles.cache.filter(r => r.id !== newMember.guild.id).map(r => r.name) },
                    metadata: {
                        discordUserId: newMember.user.id,
                        type: 'ROLES_CHANGE',
                        username: newMember.user.tag,
                        serverNickname: newNick,
                        changeDetail,
                        reason: 'Attribution ou retrait de rôles Discord',
                        ...executorMeta(rolesEx, newMember.user.id),
                    },
                },
            });
        }
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_MEMBER_UPDATE:`, error);
    }
});


// Cache for voice and stream sessions: userId -> startTime
const voiceSessions = new Map<string, number>();
const streamSessions = new Map<string, number>();

// Helper to update DB by Discord ID with better performance and logging
async function updateDiscordActivity(discordId: string, guildId: string | null, data: any, activityType: string) {
    try {
        const guildFilter = guildId ? { guild: { discordGuildId: guildId } } : {};
        
        // I-03: Replace the previous "findMany + loop of updates" with a single
        // updateMany. Reduces N+1 DB round-trips on high-frequency events
        // (messages, reactions, voice state) to a single query.
        const result = await db.userProfile.updateMany({
            where: {
                user: {
                    accounts: {
                        some: {
                            provider: "discord",
                            providerAccountId: discordId
                        }
                    }
                },
                ...guildFilter
            },
            data
        });

        if (result.count > 0) {
            console.log(`[Discord Bot] ${activityType} tracked for ${discordId} (${result.count} profile(s))`);
        } else {
            // ⚠️ Aucun profil trouvé : le matching repose sur user.accounts (table Account d'Auth.js).
            // Un membre qui ne s'est JAMAIS connecté au Dashboard n'a aucun compte lié → count=0.
            // On le loggue pour ne plus échouer en silence (diagnostic du Ladder Discord).
            console.warn(`[Discord Bot] ⚠️ ${activityType} NOT tracked for ${discordId} — aucun UserProfile correspondant (user.accounts vide ? membre jamais connecté au Dashboard ? guildId=${guildId ?? 'null'})`);
        }
    } catch (e) {
        console.error(`[Discord Bot] Error updating activity for ${discordId}:`, e);
    }
}

// 1. TRACK MESSAGES
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const charCount = message.content ? message.content.length : 0;
    const isReply = message.reference && message.reference.messageId ? 1 : 0;

    const incrementData: any = {
        discordMessageCountWeekly: { increment: 1 },
        discordMessageCountMonthly: { increment: 1 },
        discordMessageCountTotal: { increment: 1 }
    };

    if (charCount > 0) {
        incrementData.discordCharactersWeekly = { increment: charCount };
        incrementData.discordCharactersMonthly = { increment: charCount };
        incrementData.discordCharactersTotal = { increment: charCount };
    }

    if (isReply) {
        incrementData.discordRepliesWeekly = { increment: 1 };
        incrementData.discordRepliesMonthly = { increment: 1 };
        incrementData.discordRepliesTotal = { increment: 1 };
    }

    await updateDiscordActivity(message.author.id, message.guild.id, {
        lastDiscordMessageAt: new Date(),
        ...incrementData
    }, 'Message');

    // 1bis. DÉTECTION D'ACTIVITÉ SUR LES POSTS DJ/QUÊTES & SONGES
    // Si des membres discutent dans le salon ou thread lié à un post, on actualise
    // updatedAt pour éviter les faux rappels d'inactivité (J+7) du CRON.
    try {
        const channelId = message.channelId;
        const now = new Date();

        // Si le salon est un thread, le channelId peut être le thread ou son parent
        const isThread = message.channel.isThread?.() || false;
        const parentId = isThread ? (message.channel as any).parentId : null;
        const candidateChannelIds = [channelId, parentId].filter(Boolean) as string[];

        // A. Posts Donjon / Quête
        const openDjPosts = await db.djSearchPost.findMany({
            where: {
                discordChannelId: { in: candidateChannelIds },
                status: { in: ["OPEN", "FULL"] }
            },
            select: { id: true, dungeonsJson: true }
        });

        if (openDjPosts.length > 0) {
            for (const p of openDjPosts) {
                const currentJson = (p.dungeonsJson && typeof p.dungeonsJson === "object") ? p.dungeonsJson : {};
                await db.djSearchPost.update({
                    where: { id: p.id },
                    data: {
                        updatedAt: now,
                        lastReminderAt: null,
                        dungeonsJson: {
                            ...(Array.isArray(p.dungeonsJson) ? { _items: p.dungeonsJson } : currentJson),
                            _autoReminderCount: 0 // Réinitialise les rappels si les membres discutent
                        }
                    }
                });
            }
            console.log(`[Discord Bot] 💬 Activité détectée sur ${openDjPosts.length} post(s) DJ/Quête (salon ${channelId}) — updatedAt actualisé.`);
        }

        // B. Runs Songes
        const activeRuns = await db.dreamRun.findMany({
            where: {
                discordChannelId: { in: candidateChannelIds },
                status: { in: ["RECRUITING", "IN_PROGRESS"] }
            },
            select: { id: true }
        });

        if (activeRuns.length > 0) {
            for (const r of activeRuns) {
                await db.dreamRun.update({
                    where: { id: r.id },
                    data: {
                        updatedAt: now,
                        lastReminderAt: null
                    }
                });
                // Nettoyer les rappels passés car il y a eu de l'activité
                await (db as any).dreamRunReminder.deleteMany({
                    where: { runId: r.id }
                }).catch(() => {});
            }
            console.log(`[Discord Bot] 💬 Activité détectée sur ${activeRuns.length} run(s) Songes (salon ${channelId}) — updatedAt actualisé.`);
        }
    } catch (actErr) {
        console.error('[Discord Bot] Erreur détection activité salon post:', actErr);
    }
});

// 2. TRACK VOICE SESSIONS
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member?.user.bot) return;

    const userId = newState.id;
    const guildId = newState.guild.id;
    const now = Date.now();

    // --- STREAM TIME TRACKING ---
    const wasStreaming = !!oldState.streaming;
    const isStreaming = !!newState.streaming;

    // Start streaming
    if (!wasStreaming && isStreaming && newState.channelId) {
        streamSessions.set(userId, now);
        console.log(`[Discord Bot] 📺 Stream started by ${newState.member?.user.tag}`);
    }
    // Stop streaming (either stopped stream or disconnected voice completely)
    else if (wasStreaming && (!isStreaming || !newState.channelId)) {
        const streamStart = streamSessions.get(userId);
        if (streamStart) {
            const streamDurationMin = Math.round((now - streamStart) / 60000);
            if (streamDurationMin > 0) {
                await updateDiscordActivity(userId, guildId, {
                    discordVoiceStreamTimeWeekly: { increment: streamDurationMin },
                    discordVoiceStreamTimeMonthly: { increment: streamDurationMin },
                    discordVoiceStreamTimeTotal: { increment: streamDurationMin }
                }, `Stream Session (${streamDurationMin}m)`);
            }
            streamSessions.delete(userId);
        }
    }

    // --- VOICE TIME TRACKING ---
    // User joined voice completely
    if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(userId, now);
        await updateDiscordActivity(userId, guildId, { lastDiscordVoiceAt: new Date() }, 'Voice Start');
    }
    // User left voice completely
    else if (oldState.channelId && !newState.channelId) {
        const startTime = voiceSessions.get(userId);
        if (startTime) {
            const durationMin = Math.round((now - startTime) / 60000);
            if (durationMin > 0) {
                await updateDiscordActivity(userId, guildId, { 
                    discordVoiceTimeWeekly: { increment: durationMin },
                    discordVoiceTimeMonthly: { increment: durationMin },
                    discordVoiceTimeTotal: { increment: durationMin }
                }, `Voice Session (${durationMin}m)`);
            }
            voiceSessions.delete(userId);
        }
    }
    // User switched channels within Discord voice
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const startTime = voiceSessions.get(userId);
        if (startTime) {
            const durationMin = Math.round((now - startTime) / 60000);
            if (durationMin > 0) {
                await updateDiscordActivity(userId, guildId, { 
                    discordVoiceTimeWeekly: { increment: durationMin },
                    discordVoiceTimeMonthly: { increment: durationMin },
                    discordVoiceTimeTotal: { increment: durationMin }
                }, `Voice Switch (${durationMin}m)`);
            }
        }
        // Restart session time for the new channel
        voiceSessions.set(userId, now);
    }
});

// 3. TRACK REACTIONS
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.message.guild) {
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('[Discord Bot] Failed to fetch partial reaction:', error);
            }
        }

        // 1. Update last reaction date for the sender
        if (!user.bot) {
            await updateDiscordActivity(user.id, reaction.message.guild.id, { 
                lastDiscordReactionAt: new Date() 
            }, 'Reaction Sent');
        }

        // 2. Increment reactions received for the message author
        const author = reaction.message.author;
        if (author && !author.bot && author.id !== user.id) { // Only count if not reacting to own message
            await updateDiscordActivity(author.id, reaction.message.guild.id, {
                discordReactionsReceivedWeekly: { increment: 1 },
                discordReactionsReceivedMonthly: { increment: 1 },
                discordReactionsReceivedTotal: { increment: 1 }
            }, 'Reaction Received');
        }
    }
});

// (F-24) TYPING TRACKING REMOVED — GuildMessageTyping intent revoked (least privilege).

// 5. PERIODIC RESET - Every Tuesday 07:00 (Weekly) & 1st of Month (Monthly)
let lastResetWeek = -1;
let lastResetMonth = -1;

// On startup, if we are already past the reset time for the current week/month,
// set to current to prevent a reset loop on every restart.
const startupNow = new Date();
if (startupNow.getDay() === 2 && startupNow.getHours() >= 7) {
    lastResetWeek = getWeekNumber(startupNow);
}
lastResetMonth = startupNow.getMonth();

setInterval(async () => {
    const now = new Date();
    
    // Weekly Reset (Tuesdays)
    const currentWeek = getWeekNumber(now);
    if (now.getDay() === 2 && now.getHours() >= 7 && lastResetWeek !== currentWeek) {
        lastResetWeek = currentWeek;
        console.log("[Discord Bot] Weekly Reset of Discord stats starting...");
        try {
            // 🔒 Guild isolation (multi-tenant / RULES.md) : on ne reset QUE les guildes
            // du bot (client.guilds.cache), jamais toutes les guildes de la base.
            const guildIds = client.guilds.cache.map(g => g.id);
            // I-10: Scope the reset to this bot's ACTIVE guilds only to avoid a
            // massive UPDATE locking the whole table when profiles grow.
            await db.userProfile.updateMany({
                where: { status: "ACTIVE", guild: { discordGuildId: { in: guildIds } } },
                data: {
                    discordVoiceTimeWeekly: 0,
                    discordMessageCountWeekly: 0,
                    discordCharactersWeekly: 0,
                    discordReactionsReceivedWeekly: 0,
                    discordVoiceStreamTimeWeekly: 0,
                    discordRepliesWeekly: 0
                }
            });
            console.log(`[Discord Bot] Weekly Reset of Discord stats completed (${client.guilds.cache.size} guildes).`);
        } catch (e) {
            console.error(`[Discord Bot] Failed to reset Weekly Discord stats:`, e);
        }
    }

    // Monthly Reset (1st of Month)
    const currentMonth = now.getMonth();
    if (now.getDate() === 1 && now.getHours() >= 0 && lastResetMonth !== currentMonth) {
        lastResetMonth = currentMonth;
        console.log("[Discord Bot] Monthly Reset of Discord stats starting...");
        try {
            // 🔒 Guild isolation (multi-tenant / RULES.md) : on ne reset QUE les guildes du bot.
            const guildIds = client.guilds.cache.map(g => g.id);
            // I-10: Scope the reset to this bot's ACTIVE guilds only.
            await db.userProfile.updateMany({
                where: { status: "ACTIVE", guild: { discordGuildId: { in: guildIds } } },
                data: {
                    discordVoiceTimeMonthly: 0,
                    discordMessageCountMonthly: 0,
                    discordCharactersMonthly: 0,
                    discordReactionsReceivedMonthly: 0,
                    discordVoiceStreamTimeMonthly: 0,
                    discordRepliesMonthly: 0
                }
            });
            console.log(`[Discord Bot] Monthly Reset of Discord stats completed (${client.guilds.cache.size} guildes).`);
        } catch (e) {
            console.error(`[Discord Bot] Failed to reset Monthly Discord stats:`, e);
        }
    }
}, 60000);


function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ========================
// Graceful Shutdown
// ========================
process.on('SIGTERM', async () => {
    console.log('[Discord Bot] SIGTERM received, shutting down gracefully...');
    client.destroy();
    await db.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Discord Bot] SIGINT received, shutting down gracefully...');
    client.destroy();
    await db.$disconnect();
    process.exit(0);
});

// ========================
// Start Bot
// ========================
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
    console.error('[Discord Bot] ❌ DISCORD_BOT_TOKEN not found in environment variables');
    process.exit(1);
}

client.login(token).catch((error) => {
    console.error('[Discord Bot] ❌ Failed to login:', error);
    process.exit(1);
});
