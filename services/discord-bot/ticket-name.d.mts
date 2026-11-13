/**
 * Types du miroir du formatage de nom de ticket (paquet bot).
 * La parité avec `src/lib/tickets/channel-name-format.ts` est verrouillée par
 * `tests/unit/ticket-rename-bot-parity.test.ts`.
 */

export function slugifyTicketName(value: string): string;

export function renameTicketChannelName(
    currentName: string,
    oldDisplayName: string,
    newDisplayName: string
): string | null;
