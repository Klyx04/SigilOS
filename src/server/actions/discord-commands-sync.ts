"use server";

import { isSuperAdmin } from "./super-admin-actions";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DISCORD_API_BASE = "https://discord.com/api/v10";

/**
 * Construit le payload Discord Application Command pour chaque commande du catalogue.
 * On définit les options (autocomplétion) pour les commandes qui en ont besoin.
 */
function buildDiscordCommandPayloads() {
    const rawCommands: Array<{
        name: string;
        description: string;
        options?: Array<{
            name: string;
            description: string;
            type: number;
            required?: boolean;
            autocomplete?: boolean;
            choices?: Array<{ name: string; value: string }>;
        }>;
    }> = [
        {
            name: "almanax",
            description: "📅 Offrande & bonus Almanax du jour demandé",
            options: [
                {
                    name: "date",
                    description: "Date au format JJ/MM/AAAA (optionnel, défaut = aujourd'hui)",
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: "profil",
            description: "🎖️ Fiche membre : classe, succès, métiers 200, activités et planning",
            options: [
                {
                    name: "membre",
                    description: "Mentionner un membre (optionnel, défaut = soi-même)",
                    type: 6, // USER
                    required: false
                }
            ]
        },
        {
            name: "boss",
            description: "👑 Fiche d'un Boss de donjon – PV, résistances, sorts et mécaniques",
            options: [
                {
                    name: "nom",
                    description: "Nom du boss (ex: Comte Harebourg, Vortex...)",
                    type: 3, // STRING
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: "monstre",
            description: "👾 Fiche d'un monstre ou archimonstre – caractéristiques, zone et butins",
            options: [
                {
                    name: "nom",
                    description: "Nom du monstre ou archimonstre",
                    type: 3, // STRING
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: "metiers",
            description: "🔨 Trouve qui a tel métier dans la guilde, avec les niveaux",
            options: [
                {
                    name: "metier",
                    description: "Nom du métier (ex: Tailleur, Mineur, Forgemage...)",
                    type: 3, // STRING
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: "ocre",
            description: "🥚 Fiche quête Ocre – zone de pop et disponibilité des doublons en guilde",
            options: [
                {
                    name: "archimonstre",
                    description: "Nom de l'archimonstre ou monstre d'étape",
                    type: 3, // STRING
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: "valider-recrue",
            // 🧭 La commande n'a plus qu'**une** option : la recrue visée. Les six autres
            // (`pseudo-dofus`, `tag-ankama`, `recruteur`, `arrivee`, `ajouter-role`,
            // `retirer-role`) sont devenues des **champs de formulaire** : la commande ouvre
            // une **modale** préremplie (pseudo et tag Ankama lus du profil, date du jour,
            // recruteur = auteur de l'interaction) et les rôles appliqués viennent du réglage
            // RBAC de la guilde (`/dashboard/[guildId]/admin/slash-commands`). Les options
            // héritées restaient affichées par Discord (« membre » + « + 6 en plus ») alors
            // qu'elles n'étaient plus utilisées.
            description: "✅ Staff — ouvre le formulaire de validation d'une recrue (registre)",
            options: [
                {
                    name: "membre",
                    description: "La recrue à valider — le reste se remplit dans le formulaire",
                    type: 6, // USER
                    required: true
                }
            ]
        },
    ];

    // Discord API n'accepte pas `options: []` (tableau vide). On ne transmet options que s'il y en a.
    return rawCommands.map(cmd => {
        if (!cmd.options || cmd.options.length === 0) {
            const { options: _, ...rest } = cmd;
            return rest;
        }
        return cmd;
    });
}


/**
 * Enregistre (PUT = upsert bulk) toutes les commandes slash sur UN serveur Discord spécifique.
 * Utilise l'endpoint Guild Commands (instantané, pas de délai de propagation de 1h comme les globales).
 */
async function registerCommandsForGuild(discordGuildId: string): Promise<{
    ok: boolean;
    guildId: string;
    error?: string;
    count?: number;
}> {
    const appId = process.env.AUTH_DISCORD_ID || process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!appId || !botToken) {
        return { ok: false, guildId: discordGuildId, error: "Missing AUTH_DISCORD_ID / DISCORD_CLIENT_ID or DISCORD_BOT_TOKEN" };
    }

    const payloads = buildDiscordCommandPayloads();
    const url = `${DISCORD_API_BASE}/applications/${appId}/guilds/${discordGuildId}/commands`;

    try {
        const res = await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
                "User-Agent": "DiscordBot (https://sigilos.fr, 1.0.0)"
            },
            body: JSON.stringify(payloads)
        });

        if (!res.ok) {
            const errBody = await res.text();
            logger.error("[SlashCommandSync] Discord API error", { guild: discordGuildId, status: res.status, body: errBody });
            return { ok: false, guildId: discordGuildId, error: `Discord ${res.status}: ${errBody.slice(0, 200)}` };
        }

        const registered = await res.json() as any[];
        logger.info(`[SlashCommandSync] ✅ ${registered.length} commandes enregistrées pour la guilde ${discordGuildId}`);
        return { ok: true, guildId: discordGuildId, count: registered.length };
    } catch (err) {
        logger.error("[SlashCommandSync] Fetch error", { guild: discordGuildId, error: String(err) });
        return { ok: false, guildId: discordGuildId, error: String(err) };
    }
}

/**
 * GOD Action — Déploie les commandes slash sur TOUTES les guildes SigilOS actives.
 * Aussi appelable pour une seule guilde (guildId optionnel).
 */
export async function syncSlashCommandsToDiscordAction(targetGuildId?: string): Promise<{
    success: boolean;
    results: Array<{ ok: boolean; guildId: string; error?: string; count?: number }>;
    error?: string;
}> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, results: [], error: "Unauthorized: Super-admin required" };
    }

    try {
        let discordGuildIds: string[] = [];

        if (targetGuildId) {
            // Single guild sync
            const guild = await db.guildConfig.findUnique({
                where: { id: targetGuildId },
                select: { discordGuildId: true }
            });
            if (!guild) return { success: false, results: [], error: "Guild not found" };
            discordGuildIds = [guild.discordGuildId];
        } else {
            // All guilds
            const guilds = await db.guildConfig.findMany({
                where: { isActive: true },
                select: { discordGuildId: true }
            });
            discordGuildIds = guilds.map(g => g.discordGuildId);
        }

        if (discordGuildIds.length === 0) {
            return { success: false, results: [], error: "No active guilds found" };
        }

        // Run registrations sequentially (rate-limit safety — max 200 req/5s global)
        const results: Array<{ ok: boolean; guildId: string; error?: string; count?: number }> = [];
        for (const guildId of discordGuildIds) {
            const res = await registerCommandsForGuild(guildId);
            results.push(res);
            // 300ms gap between guilds to respect Discord's rate limits
            if (discordGuildIds.length > 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        const successCount = results.filter(r => r.ok).length;
        const firstError = results.find(r => !r.ok)?.error;

        return {
            success: successCount > 0,
            results,
            error: successCount === 0 ? (firstError || "Aucun serveur n'a pu être synchronisé") : undefined
        };
    } catch (err) {
        logger.error("[syncSlashCommandsToDiscordAction] Error", { error: String(err) });
        return { success: false, results: [], error: String(err) };
    }
}
