/**
 * 🏷️ **Nom du salon d'un ticket** (pur) : une seule règle pour l'ouverture, la
 * clôture et la réouverture.
 *
 * Demande user du 24/10/2026 : « une fois le ticket fermé, le salon doit passer en
 * `ticket-clos` (nom défini dans les réglages du module) ».
 */

import { formatClosedTicketChannelName, formatTicketChannelName } from "./embeds";
import { readTicketNamingSettings } from "./category-permissions";

export interface TicketChannelNamingInput {
    ticketNumber: number;
    creatorDiscordName: string;
    journey?: { name: string; namingPattern: string } | null;
    category?: { name: string } | null;
}

function namingVars(input: TicketChannelNamingInput) {
    return {
        number: input.ticketNumber,
        user: input.creatorDiscordName,
        journey: input.journey?.name || input.category?.name || "Support",
    };
}

/** Nom d'ouverture (motif du parcours, défaut `ticket-{num}`). */
export function ticketOpeningChannelName(input: TicketChannelNamingInput): string {
    return formatTicketChannelName(input.journey?.namingPattern || "ticket-{num}", namingVars(input));
}

/** Nom de fermeture (`closedChannelPattern`, défaut `ticket-clos`). */
export function ticketClosedChannelName(input: TicketChannelNamingInput, settingsJson: unknown): string {
    return formatClosedTicketChannelName(
        readTicketNamingSettings(settingsJson).closedChannelPattern,
        namingVars(input)
    );
}
