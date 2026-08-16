/**
 * Seed de démonstration — Chantier Inter-Guilde (19/08) — branche feat/inter-guilde.
 *
 * Crée des guildes "partenaires" LOCALES et les peuple, pour tester l'inter-guilde
 * DEPUIS SA vraie guilde (1290442961380835451) :
 *  - Les fausses guildes n'ont pas de serveur Discord → impossible d'Y entrer
 *    (le layout exige isMember), mais leurs données inter-guilde (arrivées,
 *    annuaire…) sont visibles depuis les guildes ouvertes du même serveur.
 *  - Guilde 1 & 2 : même serveur Dofus que la vraie guilde (pairs visibles).
 *  - Guilde 3 : serveur DIFFÉRENT (Imagiro) → prouve le cloisonnement par serveur.
 *
 * Idempotent (upserts). Refuse de tourner en production sans --force.
 * Usage : npx tsx scripts/seed-inter-guilde-demo.ts
 */
import "dotenv/config";
import { db } from "../src/lib/prisma";
import { PERMISSIONS } from "../src/lib/permissions";

const REAL_GUILD_DISCORD_ID = "1290442961380835451";

// ── Garde-fou production (jamais de fausses guildes en prod sans --force) ──
if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error("⛔ Refusé : seed inter-guilde désactivé en production. Passe --force pour passer outre.");
    process.exit(1);
}

const CLASSES = ["Féca", "Osamodas", "Enutrof", "Sram", "Xélor", "Ecaflip", "Eniripsa", "Iop", "Cra", "Féca"];
const PSEUDO_POOL = [
    "Kaelin", "Nyrah", "Sylvas", "Ormak", "Lyra", "Darell", "Mistel", "Owaï", "Zephyr", "Ilyana",
    "Bram", "Selya", "Korn", "Viviane", "Ragna", "Tilin", "Ewilan", "Spartan", "Lyss", "Drall",
];
const ALIGNMENTS = ["Bontarien", "Brâkmarien", "Neutre", "Neutre"];

async function main() {
    // ── La vraie guilde de l'utilisateur (source des pairs) ──
    const realGuild = await db.guildConfig.findUnique({
        where: { discordGuildId: REAL_GUILD_DISCORD_ID },
        select: { id: true, name: true, dofusServerId: true, dofusServerName: true, interGuildEnabled: true },
    });
    if (!realGuild) {
        console.error(`❌ Guilde réelle ${REAL_GUILD_DISCORD_ID} introuvable.`);
        process.exit(1);
    }
    const serverId = realGuild.dofusServerId || "295";
    const serverName = realGuild.dofusServerName || "Draconiros";

    // ── L'utilisateur réel (admin potentiel des fausses guildes si accès God) ──
    const realProfile = await db.userProfile.findFirst({
        where: { guildId: realGuild.id, status: "ACTIVE" },
        select: { userId: true },
        orderBy: { createdAt: "asc" },
    });
    let realUserId = realProfile?.userId || null;
    let realDiscordId: string | null = null;
    if (realUserId) {
        const acc = await db.account.findFirst({ where: { userId: realUserId, provider: "discord" }, select: { providerAccountId: true } });
        realDiscordId = acc?.providerAccountId || null;
    }
    if (!realUserId) {
        console.warn("⚠️ Aucun profil ACTIVE trouvé sur la vraie guilde — la config admin des fausses guildes sera limitée.");
    }

    // ── Activation inter-guilde sur la vraie guilde ──
    if (!realGuild.interGuildEnabled) {
        await db.guildConfig.update({ where: { id: realGuild.id }, data: { interGuildEnabled: true } });
        console.log(`✅ Inter-Guilde activé sur la vraie guilde « ${realGuild.name} ».`);
    } else {
        console.log(`ℹ️ Inter-Guilde déjà actif sur la vraie guilde.`);
    }

    const GUILD_SEEDS = [
        {
            key: "G1",
            name: "Sigil d'Émeraude",
            discordGuildId: "220000000000000001",
            serverId,
            serverName,
            memberCount: 10,
            tagline: "Guilde emblématique de Draconiros, entre émeraude et exigence.",
        },
        {
            key: "G2",
            name: "Les Brâkmariens",
            discordGuildId: "220000000000000002",
            serverId,
            serverName,
            memberCount: 8,
            tagline: "Fidèles à Brâkmar, toujours prêts à en découdre.",
        },
        {
            key: "G3",
            name: "Ordre du Veilleur",
            discordGuildId: "220000000000000003",
            serverId: "296",
            serverName: "Imagiro",
            memberCount: 6,
            tagline: "Guilde de l'ombre sur Imagiro — ne doit PAS apparaître en pair Draconiros.",
        },
    ];

    const ALL_PERMS = Object.values(PERMISSIONS) as string[];

    for (const seed of GUILD_SEEDS) {
        // 1. GuildConfig (upsert)
        const guild = await db.guildConfig.upsert({
            where: { discordGuildId: seed.discordGuildId },
            update: {
                name: seed.name,
                isActive: true,
                dofusServerId: seed.serverId,
                dofusServerName: seed.serverName,
                interGuildEnabled: true,
                welcomeEnabled: true,
                welcomeDashboardEnabled: true,
                presentationEnabled: true,
                presentationServer: seed.serverName,
                presentationRecruiting: true,
                presentationHistory: seed.tagline,
                presentationFounder: "Wylan",
                presentationMinLevel: 150,
                presentationMemberCount: seed.memberCount,
                ...(realDiscordId
                    ? { usersMapping: { [realDiscordId]: ALL_PERMS } }
                    : {}),
            },
            create: {
                discordGuildId: seed.discordGuildId,
                name: seed.name,
                isActive: true,
                dofusServerId: seed.serverId,
                dofusServerName: seed.serverName,
                interGuildEnabled: true,
                welcomeEnabled: true,
                welcomeDashboardEnabled: true,
                presentationEnabled: true,
                presentationServer: seed.serverName,
                presentationRecruiting: true,
                presentationHistory: seed.tagline,
                presentationFounder: "Wylan",
                presentationMinLevel: 150,
                presentationMemberCount: seed.memberCount,
                rolesMapping: { "test-role": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.COMMUNITY_ACCESS, PERMISSIONS.GAME_VIEW] },
                ...(realDiscordId ? { usersMapping: { [realDiscordId]: ALL_PERMS } } : {}),
            },
        });

        // 2. Whitelist (isGuildAllowed exige une ligne AllowedGuild active)
        await db.allowedGuild.upsert({
            where: { discordGuildId: seed.discordGuildId },
            update: { isActive: true, name: seed.name },
            create: { discordGuildId: seed.discordGuildId, name: seed.name, addedBy: realUserId || "seed" },
        });

        // 3. Modules actifs (rendu réaliste côté pairs/God)
        await db.guildModules.upsert({
            where: { guildId: guild.id },
            update: { roster: true, presentation: true, calendar: true, gallery: true, minigames: true, ladder: true, services: true, songes: true, ocre: true, donjons: true, missions: true, polls: true, docs: true, stats: true, profile: true, logs: true, admin: true, worldmap: true, resources: true },
            create: { guildId: guild.id, roster: true, presentation: true, calendar: true, gallery: true, minigames: true, ladder: true, services: true, songes: true, ocre: true, donjons: true, missions: true, polls: true, docs: true, stats: true, profile: true, logs: true, admin: true, worldmap: true, resources: true },
        });



        // 4. Membres fictifs (users + profils, upsert idempotent)
        let createdMembers = 0;
        for (let i = 0; i < seed.memberCount; i++) {
            const pseudo = `${seed.key}-${PSEUDO_POOL[i % PSEUDO_POOL.length]}${i < PSEUDO_POOL.length ? "" : i}`;
            const email = `seed-${seed.key.toLowerCase()}-${i}@sigilos.test`;
            const classe = CLASSES[i % CLASSES.length];
            const level = 160 + ((i * 7) % 40);

            const user = await db.user.upsert({
                where: { email },
                update: { name: pseudo },
                create: { email, name: pseudo },
            });

            const createdAt = new Date(Date.now() - (i * 3 + 1) * 3600_000);
            await db.userProfile.upsert({
                where: { userId_guildId: { userId: user.id, guildId: guild.id } },
                update: { pseudoDofus: pseudo, classe, dofusLevel: level, status: "ACTIVE", alignment: ALIGNMENTS[i % ALIGNMENTS.length] },
                create: {
                    userId: user.id,
                    guildId: guild.id,
                    status: "ACTIVE",
                    pseudoDofus: pseudo,
                    classe,
                    dofusLevel: level,
                    alignment: ALIGNMENTS[i % ALIGNMENTS.length],
                    discordNickname: pseudo,
                    discordRoleName: "Membre",
                    createdAt,
                },
            });
            createdMembers++;
        }

        // 5. Welcome posts (arrivées récentes → visibles dans le fil inter-guilde)
        const members = await db.userProfile.findMany({
            where: { guildId: guild.id, status: "ACTIVE" },
            select: { id: true, pseudoDofus: true },
            orderBy: { createdAt: "desc" },
            take: 3,
        });
        for (let w = 0; w < members.length; w++) {
            const m = members[w];
            await db.memberWelcome.upsert({
                where: { id: `seed-welcome-${seed.key}-${w}` },
                update: { content: `✨ Bienvenue ${m.pseudoDofus} !` },
                create: {
                    id: `seed-welcome-${seed.key}-${w}`,
                    guildId: guild.id,
                    profileId: m.id,
                    content: `✨ Bienvenue ${m.pseudoDofus} !`,
                    createdAt: new Date(Date.now() - (w * 2 + 1) * 3600_000),
                },
            });
        }

        console.log(`✅ ${seed.name} (${seed.discordGuildId}) — ${createdMembers} membres, ${seed.serverName}, inter-guilde ON.`);
    }

    console.log("");
    console.log("── Récap pour tester depuis ta vraie guilde ──");
    console.log(`• Vraie guilde : inter-guilde ACTIVÉ · serveur ${serverName} (${serverId})`);
    console.log(`• Pairs visibles : G1 + G2 (${serverName}). G3 (Imagiro) doit être INVISIBLE (scope serveur).`);
    console.log(`• Teste : /guilds (filtre serveur + badge), fil d'arrivées du guild-hub, /members (section inter-guilde), /admin/settings?tab=inter-guilde (compteur de pairs).`);
    console.log(`• Pour couper : désactive le toggle dans /admin/settings → Inter-Guilde.`);

    await db.$disconnect();
}

main().catch(e => {
    console.error("❌ Seed échoué :", e);
    process.exit(1);
});
