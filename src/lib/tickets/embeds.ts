/**
 * 🎫 Tickets v2 — **messages Discord** (purs, testables : aucun envoi).
 *
 * Ce fichier remplace la construction d'embeds éparpillée dans les server actions.
 * Il porte aussi le **correctif P0-2** : `buildActionRows` ne donne les boutons de
 * staff (prendre en charge, note interne, renommer, fermer) qu'à un **acteur staff**
 * — le demandeur ne les voit plus, alors qu'il les voyait dans son salon.
 */

import {
    DISCORD_ACTION_ROW,
    DISCORD_BUTTON,
    DISCORD_STRING_SELECT,
    formatAnswersForDisplay,
    type DiscordActionRow,
    type DiscordComponent,
    type TicketFormDefinition,
} from "./form-schema";

/** Limites Discord appliquées à la construction (jamais dépassées en silence). */
export const DISCORD_MAX_ROWS = 5;
export const DISCORD_TITLE_MAX = 256;
export const DISCORD_DESCRIPTION_MAX = 4096;
export const DISCORD_FIELD_VALUE_MAX = 1024;
export const DISCORD_CHANNEL_NAME_MAX = 100;

/**
 * Neutralise les mentions d'un contenu fourni par un membre : une réponse de
 * formulaire ne peut pas déclencher un ping de rôle, ni `@everyone`.
 */
export function neutralizeMentions(text: string | null | undefined): string {
    return String(text ?? "")
        .replace(/@everyone/g, "@\u200beveryone")
        .replace(/@here/g, "@\u200bhere")
        .replace(/<@!?(\d{5,})>/g, "@membre")
        .replace(/<@&(\d{5,})>/g, "@rôle")
        .replace(/<#(\d{5,})>/g, "#salon");
}

/** Tronque proprement (jamais une coupe muette). */
export function truncate(text: string, max: number): string {
    const value = String(text ?? "");
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1))}…`;
}

/** Texte destiné à un embed : mentions neutralisées puis borné. */
export function sanitizeEmbedText(text: string | null | undefined, max = DISCORD_FIELD_VALUE_MAX): string {
    return truncate(neutralizeMentions(text), max);
}

/**
 * Nom de salon Discord : minuscules, `[a-z0-9-_]`, 100 caractères maximum.
 * `{num}` `{user}` `{journey}` (alias `{category}`) sont remplacés, puis le résultat
 * est assaini — un nom de parcours accentué ne casse plus la création du salon.
 */
export function formatTicketChannelName(
    pattern: string,
    vars: { number: number; user: string; journey: string }
): string {
    const filled = (pattern || "ticket-{num}")
        .replace(/\{num\}/g, String(vars.number).padStart(4, "0"))
        .replace(/\{user\}/g, vars.user || "membre")
        .replace(/\{journey\}/g, vars.journey || "ticket")
        .replace(/\{category\}/g, vars.journey || "ticket");

    const slug = filled
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, DISCORD_CHANNEL_NAME_MAX);

    return slug.length > 0 ? slug : `ticket-${String(vars.number).padStart(4, "0")}`;
}

/** `#6366f1` → entier Discord ; toute valeur douteuse retombe sur l'indigo SigilOS. */
export function parseEmbedColor(color: string | null | undefined): number {
    const fallback = 0x6366f1;
    if (!color) return fallback;
    const match = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
    if (!match) return fallback;
    return Number.parseInt(match[1], 16);
}

/** Embed du panneau public (« Centre de support »), borné et échappé. */
export function buildPanelEmbed(input: {
    title: string;
    description: string;
    color?: string | null;
    footer?: string | null;
    thumbnail?: string | null;
    image?: string | null;
}): Record<string, unknown> {
    const embed: Record<string, unknown> = {
        title: truncate(neutralizeMentions(input.title), DISCORD_TITLE_MAX) || "Centre de support",
        description: truncate(neutralizeMentions(input.description), DISCORD_DESCRIPTION_MAX),
        color: parseEmbedColor(input.color),
        footer: { text: truncate(neutralizeMentions(input.footer || "SigilOS Tickets"), DISCORD_TITLE_MAX) },
    };
    if (input.thumbnail) embed.thumbnail = { url: input.thumbnail };
    if (input.image) embed.image = { url: input.image };
    return embed;
}

/**
 * Boutons ou menu d'un panneau. `targetKey` distingue les parcours v2 (`journey`)
 * des catégories v1 (`category`) : les panneaux **déjà déployés** continuent de
 * fonctionner, seul l'`custom_id` diffère.
 */
export function buildPanelRows(input: {
    panelId: string;
    targets: Array<{ id: string; label: string; emoji?: string | null; style?: string | null }>;
    style?: string | null;
    targetKey?: "journey" | "category";
}): DiscordActionRow[] {
    const targetKey = input.targetKey ?? "journey";
    const targets = input.targets.slice(0, 25);
    if (targets.length === 0) return [];

    if (input.style === "SELECT_MENU") {
        const action = targetKey === "journey" ? "select_journey" : "select_open";
        return [
            {
                type: DISCORD_ACTION_ROW,
                components: [
                    {
                        type: DISCORD_STRING_SELECT,
                        custom_id: `tb:${action}:${input.panelId}`,
                        placeholder: "Choisis le motif de ta demande…",
                        min_values: 1,
                        max_values: 1,
                        options: targets.map((target) => ({
                            label: truncate(target.label, 100),
                            value: target.id,
                            emoji: target.emoji ? { name: target.emoji } : undefined,
                        })),
                    },
                ],
            },
        ];
    }

    const rows: DiscordActionRow[] = [];
    for (let index = 0; index < targets.length; index += DISCORD_MAX_ROWS) {
        const slice = targets.slice(index, index + DISCORD_MAX_ROWS);
        rows.push({
            type: DISCORD_ACTION_ROW,
            components: slice.map(
                (target): DiscordComponent => ({
                    type: DISCORD_BUTTON,
                    style: discordButtonStyle(target.style),
                    label: truncate(target.label, 80),
                    custom_id: `tb:open:${input.panelId}:${target.id}`,
                    emoji: target.emoji ? { name: target.emoji } : undefined,
                })
            ),
        });
    }
    return rows;
}

/** Style Discord d'un bouton (1 primaire … 4 danger). */
export function discordButtonStyle(value: string | null | undefined): number {
    switch (value) {
        case "SECONDARY":
            return 2;
        case "SUCCESS":
            return 3;
        case "DANGER":
            return 4;
        default:
            return 1;
    }
}

/** Embed d'accueil du ticket : demandeur, motif, statut lisible et réponses du formulaire. */
export function buildTicketWelcomeEmbed(input: {
    ticketNumber: number;
    journeyName: string;
    emoji?: string | null;
    creatorDiscordId: string;
    statusLabel: string;
    form?: TicketFormDefinition | null;
    answers?: Record<string, unknown> | null;
    description?: string | null;
}): Record<string, unknown> {
    const fields: Array<{ name: string; value: string; inline: boolean }> = [
        { name: "Demandeur", value: `<@${input.creatorDiscordId}>`, inline: true },
        { name: "Motif", value: truncate(neutralizeMentions(input.journeyName), 256), inline: true },
        { name: "Statut", value: truncate(input.statusLabel, 256), inline: true },
    ];

    if (input.form && input.answers) {
        for (const row of formatAnswersForDisplay(input.form, input.answers)) {
            fields.push({
                name: truncate(`📋 ${row.label}`, DISCORD_TITLE_MAX),
                value: sanitizeEmbedText(row.value) || "*Non renseigné*",
                inline: false,
            });
        }
    }

    return {
        title: `${input.emoji || "🎫"} Ticket #${input.ticketNumber} — ${truncate(
            neutralizeMentions(input.journeyName),
            200
        )}`,
        description:
            sanitizeEmbedText(input.description, DISCORD_DESCRIPTION_MAX) ||
            `Bienvenue <@${input.creatorDiscordId}> ! Un membre de l'équipe prendra en charge ta demande.`,
        color: 0x6366f1,
        fields: fields.slice(0, 25),
        footer: { text: "SigilOS Ticket System" },
        timestamp: new Date().toISOString(),
    };
}

/**
 * 🔒 **Correctif P0-2** — les boutons d'action du ticket.
 *
 * Le demandeur ne reçoit **jamais** les boutons de staff (« Prendre en charge »,
 * « Note interne », « Renommer », « Fermer »). S'il a le droit de fermer lui-même,
 * il reçoit **uniquement** « Fermer », selon la politique publiée du parcours.
 */
export function buildActionRows(input: {
    ticketId: string;
    status: string;
    viewerIsStaff: boolean;
    viewerIsCreator: boolean;
    closePolicy?: "STAFF_ONLY" | "STAFF_OR_CREATOR" | null;
    claimed?: boolean;
}): DiscordActionRow[] {
    const openStatuses = new Set(["OPEN", "CLAIMED", "PENDING_USER", "ARCHIVE_FAILED"]);
    if (!openStatuses.has(input.status)) return [];

    if (input.viewerIsStaff) {
        return [
            {
                type: DISCORD_ACTION_ROW,
                components: [
                    {
                        type: DISCORD_BUTTON,
                        style: 3,
                        label: input.claimed ? "Relâcher" : "Prendre en charge",
                        custom_id: `tb:${input.claimed ? "release" : "claim"}:${input.ticketId}`,
                        emoji: { name: "🛡️" },
                    },
                    {
                        type: DISCORD_BUTTON,
                        style: 2,
                        label: "Note interne",
                        custom_id: `tb:note:${input.ticketId}`,
                        emoji: { name: "🔒" },
                    },
                    {
                        type: DISCORD_BUTTON,
                        style: 2,
                        label: "Renommer",
                        custom_id: `tb:rename:${input.ticketId}`,
                        emoji: { name: "✏️" },
                    },
                    {
                        type: DISCORD_BUTTON,
                        style: 4,
                        label: "Fermer le ticket",
                        custom_id: `tb:close:${input.ticketId}`,
                        emoji: { name: "📦" },
                    },
                ],
            },
        ];
    }

    // Demandeur : uniquement la fermeture, et seulement si la politique la lui donne.
    if (input.viewerIsCreator && (input.closePolicy ?? "STAFF_ONLY") === "STAFF_OR_CREATOR") {
        return [
            {
                type: DISCORD_ACTION_ROW,
                components: [
                    {
                        type: DISCORD_BUTTON,
                        style: 2,
                        label: "Fermer ma demande",
                        custom_id: `tb:close:${input.ticketId}`,
                        emoji: { name: "📦" },
                    },
                ],
            },
        ];
    }

    return [];
}

/** Boutons d'approbation d'une demande d'ouverture (aucun salon n'existe encore). */
export function buildApprovalRows(ticketId: string): DiscordActionRow[] {
    return [
        {
            type: DISCORD_ACTION_ROW,
            components: [
                {
                    type: DISCORD_BUTTON,
                    style: 3,
                    label: "Accepter la demande",
                    custom_id: `tb:approve:${ticketId}`,
                    emoji: { name: "✅" },
                },
                {
                    type: DISCORD_BUTTON,
                    style: 4,
                    label: "Refuser",
                    custom_id: `tb:refuse:${ticketId}`,
                    emoji: { name: "⛔" },
                },
            ],
        },
    ];
}

/** Cinq étoiles de satisfaction (`tb:csat:<ticketId>:<1-5>`) — seul le demandeur les voit. */
export function buildCsatRows(ticketId: string): DiscordActionRow[] {
    return [
        {
            type: DISCORD_ACTION_ROW,
            components: [1, 2, 3, 4, 5].map(
                (star): DiscordComponent => ({
                    type: DISCORD_BUTTON,
                    style: 2,
                    label: "⭐".repeat(star),
                    custom_id: `tb:csat:${ticketId}:${star}`,
                })
            ),
        },
    ];
}


