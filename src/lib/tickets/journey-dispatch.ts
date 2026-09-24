/**
 * 🎫 Tickets v2 — **traduire une étape du tunnel en réponse Discord** (pur, testable).
 *
 * Pourquoi ce fichier : `journey-tunnel.ts` dit *ce qu'il reste à demander* ; il ne dit pas
 * *comment le montrer*. Or Discord impose ses formes, et deux d'entre elles sont
 * irréversibles :
 *   · une réponse **éphémère** (type 4) porte les choix (boutons Oui/Non, menus) ;
 *   · une **modale** (type 9) porte les 5 questions texte d'une page — et **une modale
 *     soumise ne peut pas en ouvrir une autre** : après une soumission, la seule façon
 *     d'obtenir la page suivante est le bouton « Continuer » (déjà construit par
 *     `buildTicketModalContinueRows`).
 *
 * Cette traduction vit ici, hors de la route d'interactions, parce qu'elle doit être
 * **prouvée** : le `custom_id` d'une modale doit satisfaire le routeur (`parseTicketCustomId`),
 * sinon le membre remplit un questionnaire qui ne reviendra jamais — un bouton mort.
 */

import {
    neutralizeMentions,
    truncate,
} from "./embeds";
import {
    buildTicketModalContinueRows,
    type TicketTunnelStep,
} from "./journey-tunnel";
import type { DiscordActionRow } from "./form-schema";

/** Action du `custom_id` d'une modale d'ouverture (`tb:modal_open:{panneau}:{parcours}`). */
export const TICKET_MODAL_OPEN_ACTION = "modal_open";

/**
 * Segment de **panneau** d'une modale ouverte depuis l'étape des choix : le `tb_pick` ne
 * transporte pas le panneau, et le brouillon se retrouve par (guilde, parcours, membre).
 * Une valeur stable et lisible vaut mieux qu'un segment vide, que le routeur refuserait.
 */
export const TICKET_PANEL_ABSENT = "sans-panneau";

/** Limite Discord du titre d'une modale. */
export const TICKET_MODAL_TITLE_MAX = 45;

/** Réponse Discord à produire pour une étape. `open` = il n'y a plus rien à demander. */
export type TicketTunnelReply =
    | { kind: "choices"; content: string; components: DiscordActionRow[] }
    | { kind: "modal"; customId: string; title: string; components: DiscordActionRow[] }
    | { kind: "open"; content: string };

/** Réponse à une étape, **soumission de modale comprise** (le bouton « Continuer » en plus). */
export type TicketStepReply =
    | TicketTunnelReply
    | { kind: "continue"; content: string; components: DiscordActionRow[] };

/** Message public d'ouverture (jamais de mention : le nom du parcours vient de l'admin). */
function journeyLabel(journeyName: string): string {
    return truncate(neutralizeMentions(journeyName), 80) || "Ticket";
}

/**
 * Réponse à une étape du tunnel, quand l'interaction reçue était un **clic** (bouton ou
 * menu) : une modale est alors une réponse autorisée.
 */
export function buildTicketTunnelReply(input: {
    step: TicketTunnelStep;
    panelId?: string;
    journeyId: string;
    journeyName: string;
}): TicketTunnelReply {
    const label = journeyLabel(input.journeyName);

    if (input.step.kind === "choices") {
        const asked = input.step.fieldIds.length;
        const later = input.step.remaining;
        return {
            kind: "choices",
            content:
                `🎫 **${label}** — ${asked} question(s) à choix` +
                (later > 0 ? `, puis ${later} autre(s)` : "") +
                " avant le questionnaire.",
            components: input.step.rows,
        };
    }

    if (input.step.kind === "modal") {
        const panelSegment = (input.panelId ?? "").trim() || TICKET_PANEL_ABSENT;
        return {
            kind: "modal",
            // Le routeur exige `{panneau}:{parcours}` : c'est ce `custom_id` qui reviendra
            // à la soumission, et c'est lui qui rattache les réponses au bon brouillon.
            customId: `tb:${TICKET_MODAL_OPEN_ACTION}:${panelSegment}:${input.journeyId}`,
            title: `📝 ${label} — page ${input.step.page + 1}/${input.step.pageCount}`.slice(
                0,
                TICKET_MODAL_TITLE_MAX
            ),
            components: input.step.rows,
        };
    }

    return { kind: "open", content: `✅ **${label}** — tout est renseigné.` };
}

/**
 * Réponse **après une soumission de modale**. Discord interdit d'en ouvrir une autre :
 * si la page suivante est une modale, on répond par un éphémère qui porte le bouton
 * « Continuer » — le membre clique, et la page suivante s'ouvre (jamais de cul-de-sac).
 */
export function buildTicketModalSubmittedReply(input: {
    step: TicketTunnelStep;
    journeyId: string;
    journeyName: string;
}): Extract<TicketStepReply, { kind: "continue" | "choices" | "open" }> {
    const label = journeyLabel(input.journeyName);

    if (input.step.kind === "modal") {
        return {
            kind: "continue",
            content:
                `✅ Page ${input.step.page + 1}/${input.step.pageCount} enregistrée — ` +
                `${input.step.fieldIds.length} question(s) sur la page suivante.`,
            components: buildTicketModalContinueRows({
                journeyId: input.journeyId,
                page: input.step.page,
                pageCount: input.step.pageCount,
                fieldCount: input.step.fieldIds.length,
            }),
        };
    }

    if (input.step.kind === "choices") {
        return {
            kind: "choices",
            content: `🎫 **${label}** — encore ${input.step.remaining} question(s) à choix.`,
            components: input.step.rows,
        };
    }

    return { kind: "open", content: `✅ **${label}** — tout est renseigné.` };
}

/** Confirmation d'ouverture (le salon vient d'être créé). */
export function buildTicketOpenedContent(channelId: string): string {
    return `✅ Ton ticket est ouvert : <#${channelId}>`;
}

/** Refus d'ouverture — toujours **motivé** (jamais un échec muet côté Discord). */
export function buildTicketOpenRefusal(reason: string): string {
    return `❌ ${truncate(neutralizeMentions(reason), 1800) || "Impossible d'ouvrir le ticket."}`;
}
