/**
 * 🎫 Tickets — **plafonds plateforme** (God) : rétention, transcripts, quotas max.
 *
 * Les guildes règlent en dessous (Max/membre), jamais au-dessus : toute valeur
 * de guilde est **plafonnée** (`clampTicketGuildQuotas`) et les durées/flags
 * consommés par le moteur viennent **d'ici**, jamais de la guilde.
 *
 * Stockage : colonnes `PlatformConfig` (migration
 * `20261228000000_ticket_platform_limits`). Lecture via
 * `getTicketPlatformLimits()` (server) : ligne absente ou panne ⇒ **défauts
 * sûrs** + avertissement (un ticket continue de s'ouvrir, avec des archives
 * courtes — jamais de stockage illimité par défaut).
 */

export const TICKET_PLATFORM_LIMIT_DEFAULTS = {
    transcriptsEnabled: true,
    retentionArchivesDays: 90,
    retentionNotesDays: 90,
    retentionAuditDays: 180,
    maxPerUserCap: 5,
    maxGuildCap: 100,
} as const;

export type TicketPlatformLimits = {
    transcriptsEnabled: boolean;
    retentionArchivesDays: number;
    retentionNotesDays: number;
    retentionAuditDays: number;
    maxPerUserCap: number;
    maxGuildCap: number;
};

/** Bornes du panneau God (une guilde ne peut pas remplir le VPS). */
export const TICKET_PLATFORM_LIMIT_BOUNDS = {
    retentionArchivesDays: { min: 7, max: 365 },
    retentionNotesDays: { min: 7, max: 365 },
    retentionAuditDays: { min: 30, max: 730 },
    maxPerUserCap: { min: 1, max: 10 },
    maxGuildCap: { min: 5, max: 500 },
} as const;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : NaN;
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

/** Ligne `PlatformConfig` (ou `null`) → limites effectives, toujours bornées. */
export function readTicketPlatformLimits(raw: unknown): TicketPlatformLimits {
    const input =
        raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : null;
    return {
        transcriptsEnabled: input?.ticketTranscriptsEnabled !== false,
        retentionArchivesDays: clampInt(
            input?.ticketRetentionArchivesDays,
            TICKET_PLATFORM_LIMIT_BOUNDS.retentionArchivesDays.min,
            TICKET_PLATFORM_LIMIT_BOUNDS.retentionArchivesDays.max,
            TICKET_PLATFORM_LIMIT_DEFAULTS.retentionArchivesDays
        ),
        retentionNotesDays: clampInt(
            input?.ticketRetentionNotesDays,
            TICKET_PLATFORM_LIMIT_BOUNDS.retentionNotesDays.min,
            TICKET_PLATFORM_LIMIT_BOUNDS.retentionNotesDays.max,
            TICKET_PLATFORM_LIMIT_DEFAULTS.retentionNotesDays
        ),
        retentionAuditDays: clampInt(
            input?.ticketRetentionAuditDays,
            TICKET_PLATFORM_LIMIT_BOUNDS.retentionAuditDays.min,
            TICKET_PLATFORM_LIMIT_BOUNDS.retentionAuditDays.max,
            TICKET_PLATFORM_LIMIT_DEFAULTS.retentionAuditDays
        ),
        maxPerUserCap: clampInt(
            input?.ticketMaxPerUserCap,
            TICKET_PLATFORM_LIMIT_BOUNDS.maxPerUserCap.min,
            TICKET_PLATFORM_LIMIT_BOUNDS.maxPerUserCap.max,
            TICKET_PLATFORM_LIMIT_DEFAULTS.maxPerUserCap
        ),
        maxGuildCap: clampInt(
            input?.ticketMaxGuildCap,
            TICKET_PLATFORM_LIMIT_BOUNDS.maxGuildCap.min,
            TICKET_PLATFORM_LIMIT_BOUNDS.maxGuildCap.max,
            TICKET_PLATFORM_LIMIT_DEFAULTS.maxGuildCap
        ),
    };
}

/**
 * Plafonne les quotas d'une guilde (source de vérité côté serveur : le dashboard
 * affiche déjà le plafond, mais seul ce clamp compte).
 */
export function clampTicketGuildQuotas(
    input: { maxActiveTicketsPerUser: number; maxTicketsTotalGuild: number },
    limits: TicketPlatformLimits
): { maxActiveTicketsPerUser: number; maxTicketsTotalGuild: number } {
    return {
        maxActiveTicketsPerUser: Math.min(
            Math.max(1, Math.trunc(input.maxActiveTicketsPerUser) || 1),
            limits.maxPerUserCap
        ),
        maxTicketsTotalGuild: Math.min(
            Math.max(5, Math.trunc(input.maxTicketsTotalGuild) || 5),
            limits.maxGuildCap
        ),
    };
}
