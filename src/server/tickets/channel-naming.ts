import { logger } from "@/lib/logger";
import { renameChannelDiscord } from "@/server/discord";
import {
    ticketClosedChannelName,
    ticketOpeningChannelName,
    type TicketChannelNamingInput,
} from "@/lib/tickets/channel-naming";

/**
 * 🏷️ Renommages Discord liés à l'état d'un ticket (clôture / réouverture).
 * Les noms eux-mêmes sont calculés par la règle pure
 * `@/lib/tickets/channel-naming` ; ici, seulement l'appel Discord et le log.
 * Un échec ne fait **jamais** échouer la clôture : c'est un `warn`.
 */

export type { TicketChannelNamingInput } from "@/lib/tickets/channel-naming";

/** Renomme le salon à la clôture. Ne jette jamais : la clôture reste valide. */
export async function renameTicketChannelOnClose(input: {
    discordChannelId: string | null | undefined;
    naming: TicketChannelNamingInput;
    settingsJson: unknown;
    ticketId: string;
}): Promise<{ renamed: boolean; name?: string; error?: string }> {
    if (!input.discordChannelId) return { renamed: false };
    const name = ticketClosedChannelName(input.naming, input.settingsJson);
    const result = await renameChannelDiscord(input.discordChannelId, name);
    if (!result.success) {
        logger.warn("[TicketChannelNaming] renommage de clôture non appliqué", {
            ticketId: input.ticketId,
            error: result.error ?? "inconnu",
        });
        return { renamed: false, name, error: result.error };
    }
    return { renamed: true, name };
}

/** Rétablit le nom d'ouverture à la réouverture. Ne jette jamais. */
export async function restoreTicketChannelNameOnReopen(input: {
    discordChannelId: string | null | undefined;
    naming: TicketChannelNamingInput;
    ticketId: string;
}): Promise<{ renamed: boolean; name?: string; error?: string }> {
    if (!input.discordChannelId) return { renamed: false };
    const name = ticketOpeningChannelName(input.naming);
    const result = await renameChannelDiscord(input.discordChannelId, name);
    if (!result.success) {
        logger.warn("[TicketChannelNaming] renommage de réouverture non appliqué", {
            ticketId: input.ticketId,
            error: result.error ?? "inconnu",
        });
        return { renamed: false, name, error: result.error };
    }
    return { renamed: true, name };
}
