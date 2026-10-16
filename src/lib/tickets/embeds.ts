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
import { TICKET_BUTTON_EMOJIS, ticketLabel, type TicketLang } from "./ticket-texts";
import { ticketButtonLayout, type TicketButtonKey, type TicketButtonSettings } from "./button-config";
import {
    ticketButtonLayoutForMotif,
    type TicketMotifButtonOverrides,
} from "./category-permissions";
import { ticketIconPayload } from "./ticket-icons";

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
                            emoji: target.emoji ? ticketIconPayload(target.emoji) : undefined,
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
                    emoji: target.emoji ? ticketIconPayload(target.emoji) : undefined,
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

/**
 * Embed n°1 — **accueil** : demandeur, motif, statut et photo du créateur.
 * Le texte libre du motif (`welcomeMessage`, écrit par le staff : markdown et
 * mentions autorisés) ouvre le salon ; les réponses du questionnaire partent
 * dans un **second** embed (`buildTicketAnswersEmbed`).
 */
export function buildTicketWelcomeEmbed(input: {
    ticketNumber: number;
    journeyName: string;
    emoji?: string | null;
    creatorDiscordId: string;
    creatorAvatarUrl?: string | null;
    statusLabel: string;
    welcomeMessage?: string | null;
    lang?: TicketLang;
    /**
     * 🆕 Flocon du membre qui a pris en charge : ajouté à l'embed et **mis à jour en
     * direct** au clic sur « Prendre en charge » (constat : le salon n'indiquait nulle
     * part qui traitait la demande).
     */
    claimedByDiscordId?: string | null;
}): Record<string, unknown> {
    const lang = input.lang ?? "fr";
    const fields: Array<{ name: string; value: string; inline: boolean }> = [
        { name: lang === "en" ? "Requester" : "Demandeur", value: `<@${input.creatorDiscordId}>`, inline: true },
        { name: lang === "en" ? "Reason" : "Motif", value: truncate(neutralizeMentions(input.journeyName), 256), inline: true },
        { name: lang === "en" ? "Status" : "Statut", value: truncate(input.statusLabel, 256), inline: true },
    ];

    // Un flocon valide seulement : jamais un `User.id` interne (mention morte).
    const claimer = String(input.claimedByDiscordId ?? "").trim();
    if (/^\d{15,21}$/.test(claimer)) {
        fields.push({
            name: lang === "en" ? "Handled by" : "Pris en charge par",
            value: `<@${claimer}>`,
            inline: true,
        });
    }

    const fallback =
        lang === "en"
            ? `Welcome <@${input.creatorDiscordId}>! A staff member will take care of your request.`
            : `Bienvenue <@${input.creatorDiscordId}> ! Un membre de l'équipe prendra en charge ta demande.`;
    // Message du staff : on borne la longueur mais on garde son markdown et ses
    // mentions (c'est lui qui ping le créateur et les rôles, pas un membre).
    const description = (input.welcomeMessage?.trim() || "").slice(0, DISCORD_DESCRIPTION_MAX) || fallback;

    const embed: Record<string, unknown> = {
        title: `${input.emoji || "🎫"} Ticket #${input.ticketNumber} — ${truncate(
            neutralizeMentions(input.journeyName),
            200
        )}`,
        description,
        color: 0x6366f1,
        fields: fields.slice(0, 25),
        footer: { text: "SigilOS Ticket System" },
        timestamp: new Date().toISOString(),
    };
    if (input.creatorAvatarUrl) embed.thumbnail = { url: input.creatorAvatarUrl };
    return embed;
}

/**
 * Champs Discord d'un embed : **25 maximum**. Le contrat de formulaire borne déjà les
 * questions à `TICKET_FORM_MAX_FIELDS` (20) : aucune réponse ne peut donc être perdue ici.
 * La constante reste explicite (et testée contre la borne des questions) pour qu'une
 * future hausse du nombre de questions ne se traduise pas par des réponses muettes.
 */
export const DISCORD_EMBED_FIELDS_MAX = 25;

/**
 * Valeur d'un champ de réponse, **honnête** : mentions neutralisées, et si Discord impose
 * une coupe (1 024 caractères — un paragraphe peut monter à 4 000), on l'**écrit** au lieu
 * de tronquer en silence.
 */
function embedAnswerValue(raw: string): string {
    const text = neutralizeMentions(raw);
    if (!text.trim()) return "*Non renseigné*";
    if (text.length <= DISCORD_FIELD_VALUE_MAX) return text;
    const marker = " … *(suite dans la copie des messages)*";
    return `${truncate(text, Math.max(1, DISCORD_FIELD_VALUE_MAX - marker.length))}${marker}`;
}

/** Embed n°2 — **réponses du questionnaire** (absent en ouverture directe). */
export function buildTicketAnswersEmbed(input: {
    ticketNumber: number;
    form: TicketFormDefinition;
    answers: Record<string, unknown>;
    lang?: TicketLang;
}): Record<string, unknown> | null {
    const rows = formatAnswersForDisplay(input.form, input.answers);
    if (rows.length === 0) return null;

    return {
        title: input.lang === "en" ? `📋 Ticket #${input.ticketNumber} — Answers` : `📋 Ticket #${input.ticketNumber} — Réponses`,
        color: 0x57f287,
        fields: rows.slice(0, DISCORD_EMBED_FIELDS_MAX).map((row) => ({
            name: truncate(`📋 ${row.label}`, DISCORD_TITLE_MAX),
            value: embedAnswerValue(row.value),
            inline: false,
        })),
        footer: { text: "SigilOS Ticket System" },
        timestamp: new Date().toISOString(),
    };
}

/**
 * Embed de l'**enquête de satisfaction** (pur : le serveur l'envoie, en MP ou dans le
 * salon fermé). Une seule source de vérité ⇒ la fermeture depuis Discord **et** depuis
 * le dashboard posent exactement la même question (constat : le chemin dashboard
 * n'envoyait aucune enquête).
 */
export function buildTicketCsatEmbed(input: {
    ticketNumber: number;
    motifName: string;
    guildName: string;
    lang?: TicketLang;
}): { title: string; description: string; color: number; footer: { text: string } } {
    if (input.lang === "en") {
        return {
            title: `⭐ Your feedback on Ticket #${input.ticketNumber}`,
            description: `Your ticket about **${input.motifName}** on **${input.guildName}** has just been closed.\n\nHow would you rate the handling of your request?`,
            color: 0x5865f2,
            footer: { text: "SigilOS Feedback" },
        };
    }
    return {
        title: `⭐ Votre avis sur le Ticket #${input.ticketNumber}`,
        description: `Votre ticket concernant **${input.motifName}** sur **${input.guildName}** vient d'être clôturé.\n\nComment évaluez-vous la prise en charge de votre demande ?`,
        color: 0x5865f2,
        footer: { text: "SigilOS Feedback" },
    };
}

/** Libellé d'état affiché dans l'embed d'accueil (une seule source, FR/EN). */
export function ticketStatusLabel(status: string, lang: TicketLang = "fr"): string {
    const fr: Record<string, string> = {
        OPEN: "🟡 En attente de prise en charge",
        CLAIMED: "🟢 Pris en charge",
        PENDING_USER: "🟡 En attente du demandeur",
        CLOSED: "📦 Fermé",
        ARCHIVE_FAILED: "🟠 Archive incomplète",
        REFUSED: "⛔ Refusé",
    };
    const en: Record<string, string> = {
        OPEN: "🟡 Waiting for staff",
        CLAIMED: "🟢 Claimed",
        PENDING_USER: "🟡 Waiting for the requester",
        CLOSED: "📦 Closed",
        ARCHIVE_FAILED: "🟠 Incomplete archive",
        REFUSED: "⛔ Refused",
    };
    const table = lang === "en" ? en : fr;
    return table[status] ?? table.OPEN;
}

/** Styles Discord des boutons du salon (un bouton fermer/rouge, un prendre en charge/vert). */
const TICKET_BUTTON_STYLES: Record<TicketButtonKey, number> = {
    claim: 3, // vert — « je m'en occupe »
    close: 4, // rouge — geste destructif sur la demande
    reopen: 3, // vert — on remet le ticket en service
    transcript: 2, // gris — consultation
    delete: 4, // rouge — suppression définitive du salon
};

/**
 * Boutons d'action du salon — **demande user du 16/10/2026** : deux boutons seulement
 * (« Prendre en charge », « Fermer le ticket »), puis après clôture **Rouvrir**,
 * **Transcript** et **Supprimer le salon**.
 *
 * Chaque bouton est **renommable et ré-icônifiable** (réglages `settingsJson.buttons`) et
 * son **droit est appliqué au clic** (`guardTicketAction`, fail-closed) : Discord affiche
 * les mêmes composants à tout le monde, donc cacher un bouton à une personne est
 * impossible — c'est l'action qui décide, jamais l'affichage.
 */
export function buildActionRows(input: {
    ticketId: string;
    status: string;
    lang?: TicketLang;
    /** Réglages de boutons de la guilde (`settingsJson.buttons`), déjà nettoyés. */
    buttons?: TicketButtonSettings | null;
    /**
     * 🆕 Surcharge du motif (`settingsJson.categories[<motif>].buttons`) : un
     * bouton retiré ou renommé pour CE salon. Absent = héritage total du global.
     */
    motifButtons?: TicketMotifButtonOverrides | null;
}): DiscordActionRow[] {
    const lang = input.lang ?? "fr";
    const buttons = input.motifButtons
        ? ticketButtonLayoutForMotif(input.status, input.motifButtons, input.buttons, lang)
        : ticketButtonLayout(input.status, input.buttons, lang);
    if (buttons.length === 0) return [];

    return [
        {
            type: DISCORD_ACTION_ROW,
            components: buttons.map(
                (button): DiscordComponent => ({
                    type: DISCORD_BUTTON,
                    style: TICKET_BUTTON_STYLES[button.key],
                    label: button.label,
                    custom_id: `tb:${button.key}:${input.ticketId}`,
                    emoji: button.emoji ? { name: button.emoji } : undefined,
                })
            ),
        },
    ];
}

/** Confirmation de fermeture (éphémère). */
export function buildCloseConfirmRows(ticketId: string, lang: TicketLang = "fr"): DiscordActionRow[] {
    return [
        {
            type: DISCORD_ACTION_ROW,
            components: [
                {
                    type: DISCORD_BUTTON,
                    style: 4,
                    label: ticketLabel("confirmClose", lang),
                    custom_id: `tb:close_confirm:${ticketId}`,
                    emoji: { name: TICKET_BUTTON_EMOJIS.close },
                },
                {
                    type: DISCORD_BUTTON,
                    style: 2,
                    label: ticketLabel("cancel", lang),
                    custom_id: `tb:cancel_close:${ticketId}`,
                    emoji: { name: TICKET_BUTTON_EMOJIS.cancel },
                },
            ],
        },
    ];
}

/** Confirmation de suppression (éphémère). */
export function buildDeleteConfirmRows(ticketId: string, lang: TicketLang = "fr"): DiscordActionRow[] {
    return [
        {
            type: DISCORD_ACTION_ROW,
            components: [
                {
                    type: DISCORD_BUTTON,
                    style: 4,
                    label: ticketLabel("confirmDelete", lang),
                    custom_id: `tb:delete_confirm:${ticketId}`,
                    emoji: { name: TICKET_BUTTON_EMOJIS.delete },
                },
                {
                    type: DISCORD_BUTTON,
                    style: 2,
                    label: ticketLabel("cancel", lang),
                    custom_id: `tb:cancel_delete:${ticketId}`,
                    emoji: { name: TICKET_BUTTON_EMOJIS.cancel },
                },
            ],
        },
    ];
}

/**
 * Message de modération posté **dans le salon après fermeture** (façon TicketTool
 * « Moderator message ») : Rouvrir / Transcript / Supprimer — **exactement** la même barre
 * que celle révélée dans l'embed d'accueil (`buildActionRows` en état `CLOSED`), donc
 * jamais deux vérités ni deux boutons « Supprimer » différents.
 * Le salon n'est **plus supprimé** à la clôture : la suppression est un geste explicite
 * avec confirmation (et compte à rebours depuis le 16/10/2026).
 */
export function buildModerationRows(
    ticketId: string,
    lang: TicketLang = "fr",
    buttons?: TicketButtonSettings | null,
    motifButtons?: TicketMotifButtonOverrides | null
): DiscordActionRow[] {
    return buildActionRows({ ticketId, status: "CLOSED", lang, buttons, motifButtons });
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


