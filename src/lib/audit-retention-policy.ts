/**
 * Politique de rétention des logs d'audit — **source unique**, pure (sans Prisma,
 * sans `"use server"`).
 *
 * Décision user (audit croisé du 24/09/2026) : **90 j pour les logs God**
 * (traçabilité plateforme) et **30 j pour les logs de guilde** (les admins
 * exportent avant purge). Avant ce correctif, une seule constante `RETENTION_DAYS
 * = 30` s'appliquait aux deux, y compris aux lignes `isGodLog: true` — le badge
 * « Archive Système » de `/god/logs` promettait donc une archive qui n'existait pas.
 *
 * Consommée par le core serveur (`src/server/audit-retention.ts`) **et** par le
 * janitor du VPS (`scripts/database-janitor.ts`, import relatif — il ne connaît
 * pas les alias `@/`), pour que la politique ne dérive jamais entre les deux.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Rétention par nature de journal (jours). */
export const AUDIT_RETENTION_DAYS = {
    /** Actions plateforme (staff) : plus longue, elle sert de piste d'audit. */
    GOD: 90,
    /** Actions d'une guilde : courte, le client est prévenu et peut exporter. */
    GUILD: 30,
} as const;

/**
 * Taille du lot par guilde **et** par passe. Le cron tourne 1×/j et l'index
 * `@@index([guildId, createdAt])` porte la sélection : un lot large évite des
 * dizaines de passes sans jamais charger une table entière dans une transaction.
 */
export const AUDIT_PURGE_BATCH_SIZE = 500;

export function resolveAuditRetentionDays(isGodLog: boolean): number {
    return isGodLog ? AUDIT_RETENTION_DAYS.GOD : AUDIT_RETENTION_DAYS.GUILD;
}

/** Date de coupure : « ce qui a été journalisé **avant** N jours ». */
export function auditPurgeCutoff(now: Date, isGodLog: boolean): Date {
    return new Date(now.getTime() - resolveAuditRetentionDays(isGodLog) * MS_PER_DAY);
}
