/**
 * 🎫 Tickets v2 — **politique d'archive** (pure, sans I/O).
 *
 * Constats de l'audit du 24/09/2026 que ce fichier verrouille :
 *   · la capture était bornée à **100 messages sans le dire** (`Math.min(limit, 100)`)
 *     et `messageCount` présenté comme complet — une archive tronquée ne doit
 *     **jamais** s'annoncer complète ;
 *   · un **seul** document servait à la fois d'archive partageable et d'annexe staff,
 *     avec les notes internes dedans : le document partageable n'en contient plus
 *     aucune, l'annexe interne est un objet distinct ;
 *   · le jeton d'accès était **permanent** (ni `expiresAt` ni `revokedAt`).
 */

export const TICKET_ARCHIVE_KINDS = ["SHAREABLE", "INTERNAL"] as const;
export type TicketArchiveKind = (typeof TICKET_ARCHIVE_KINDS)[number];

export const TICKET_ARCHIVE_KIND_LABELS: Record<TicketArchiveKind, string> = {
    SHAREABLE: "Archive partageable (sans notes internes)",
    INTERNAL: "Annexe interne (équipe uniquement)",
};

/** Taille d'une page de messages (limite dure de l'API Discord). */
export const TICKET_MESSAGE_PAGE_SIZE = 100;

/**
 * Plafond de capture : au-delà, l'archive est marquée **partielle** et le dit.
 * Volontairement haut (5 000) : un ticket normal passe entier, un cas pathologique
 * ne bloque pas la fermeture.
 */
export const TICKET_MESSAGE_HARD_CAP = 5000;

export type TicketArchivePlan = {
    kind: TicketArchiveKind;
    /** Les notes internes ne sont incluses que dans l'annexe interne. */
    includeNotes: boolean;
    /** Nombre de messages au-delà duquel la pagination s'arrête. */
    maxMessages: number;
};

export function buildArchivePlan(kind: TicketArchiveKind): TicketArchivePlan {
    return { kind, includeNotes: kind === "INTERNAL", maxMessages: TICKET_MESSAGE_HARD_CAP };
}

/** Le document partageable ne contient **jamais** une note interne (§1.5 des principes). */
export function shouldIncludeNotes(kind: TicketArchiveKind): boolean {
    return kind === "INTERNAL";
}

export type TicketArchiveCompleteness = {
    partial: boolean;
    /** Messages réellement capturés (jamais gonflé). */
    messageCount: number;
    /** Messages présents dans le salon, si la pagination a pu les compter. */
    totalCount: number | null;
    /** Phrase affichée dans l'archive et l'inbox — jamais « complète » si partielle. */
    note: string;
};

/**
 * Établit l'état de complétude. Un dépassement de plafond, une pagination
 * **interrompue** (`stopped`) **ou** un total connu supérieur au capturé
 * ⇒ `partial: true` (et la phrase le dit explicitement).
 */
export function evaluateCompleteness(input: {
    captured: number;
    total?: number | null;
    hardCap?: number;
    /** La pagination s'est arrêtée avant la fin (page en échec, plafond atteint). */
    stopped?: boolean;
}): TicketArchiveCompleteness {
    const hardCap = input.hardCap ?? TICKET_MESSAGE_HARD_CAP;
    const captured = Math.max(0, input.captured);
    const total = typeof input.total === "number" && input.total >= 0 ? input.total : null;
    const truncatedByCap = captured >= hardCap;
    const truncatedByTotal = total !== null && total > captured;
    const partial = Boolean(input.stopped) || truncatedByCap || truncatedByTotal;

    let note: string;
    if (!partial) {
        note = `${captured} message${captured > 1 ? "s" : ""} capturé${captured > 1 ? "s" : ""}`;
    } else if (total !== null) {
        const missing = Math.max(0, total - captured);
        note = `Archive partielle — ${captured} message(s) capturé(s) sur ${total} (${missing} manquant(s))`;
    } else {
        note = `Archive partielle — capture arrêtée à ${captured} messages (plafond atteint)`;
    }

    return { partial, messageCount: captured, totalCount: total, note };
}

/**
 * Échéance d'une archive : `retentionDays = 0` ⇒ jamais expirée (`null`).
 * Toute autre valeur donne une date ; le stockage ne décide rien, il obéit.
 */
export function computeExpiry(now: Date, retentionDays: number): Date | null {
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) return null;
    return new Date(now.getTime() + Math.floor(retentionDays) * 24 * 60 * 60 * 1000);
}

export type TicketArchiveAccessReason = "REVOKED" | "EXPIRED" | "NOT_FOUND";

export type TicketArchiveAccessDecision =
    | { allowed: true }
    | { allowed: false; reason: TicketArchiveAccessReason };

export const TICKET_ARCHIVE_ACCESS_MESSAGES: Record<TicketArchiveAccessReason, string> = {
    REVOKED: "Cette archive a été révoquée par l'équipe du serveur.",
    EXPIRED: "Cette archive a expiré et n'est plus accessible.",
    NOT_FOUND: "Archive introuvable ou expirée",
};

/**
 * Une archive est lisible si elle existe, n'est pas révoquée et n'est pas expirée.
 * `null` ⇒ refus (jamais un accès accordé par défaut).
 */
export function evaluateArchiveAccess(
    archive: { expiresAt?: Date | null; revokedAt?: Date | null } | null | undefined,
    now: Date
): TicketArchiveAccessDecision {
    if (!archive) return { allowed: false, reason: "NOT_FOUND" };
    if (archive.revokedAt) return { allowed: false, reason: "REVOKED" };
    if (archive.expiresAt && archive.expiresAt.getTime() <= now.getTime()) {
        return { allowed: false, reason: "EXPIRED" };
    }
    return { allowed: true };
}

/** Faut-il capturer une archive ? (module actif + salon encore présent) */
export function shouldCaptureTranscript(input: { enabled: boolean; hasChannel: boolean }): boolean {
    return input.enabled && input.hasChannel;
}

/** Durée de vie d'un brouillon d'ouverture (TTL court, réutilisable si reprise). */
export const TICKET_DRAFT_TTL_MINUTES = 30;

export function computeDraftExpiry(now: Date, ttlMinutes: number = TICKET_DRAFT_TTL_MINUTES): Date {
    const minutes = Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? Math.floor(ttlMinutes) : TICKET_DRAFT_TTL_MINUTES;
    return new Date(now.getTime() + minutes * 60 * 1000);
}

/** Un brouillon expiré n'est jamais repris : il est remplacé (jamais fusionné à l'aveugle). */
export function isDraftExpired(draft: { expiresAt: Date }, now: Date): boolean {
    return draft.expiresAt.getTime() <= now.getTime();
}
