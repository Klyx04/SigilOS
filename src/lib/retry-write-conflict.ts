/**
 * Rejeu des transactions **sérialisables** interrompues par un conflit d'écriture.
 *
 * Mesure du 30/10/2026 (PostgreSQL local, Prisma 7 + `@prisma/adapter-pg`, deux
 * transactions concurrentes qui lisent puis écrivent) :
 *  - opérations **de modèle** ⇒ `PrismaClientKnownRequestError` **P2034** ;
 *  - opérations **brutes** (`$queryRaw*`) ⇒ **P2010** dont le message porte
 *    « Raw query failed. Code: `40001` » ;
 *  - SQLSTATE **40001** (sérialisation) et **40P01** (deadlock) sont les deux seuls cas
 *    rejouables : PostgreSQL a **annulé** la transaction, rien n'a été écrit.
 *
 * Un conflit non reconnu n'est **jamais** rejoué (fail-closed : l'erreur remonte).
 */

/** SQLSTATE PostgreSQL d'un conflit rejouable. */
const RETRYABLE_SQLSTATES = ["40001", "40P01"] as const;

/** Code Prisma d'un conflit d'écriture (opérations de modèle). */
const PRISMA_WRITE_CONFLICT = "P2034";

/** Nombre total de tentatives d'une transaction sérialisable (1 = aucune reprise). */
export const WRITE_CONFLICT_ATTEMPTS = 3;

/**
 * Vrai si l'erreur est un **conflit d'écriture rejouable** (transaction annulée par
 * PostgreSQL), faux pour tout le reste — y compris une erreur inconnue.
 */
export function isWriteConflict(error: unknown): boolean {
    const candidate = error as { code?: unknown; message?: unknown } | null;
    const code = typeof candidate?.code === "string" ? candidate.code : "";
    if (code === PRISMA_WRITE_CONFLICT) return true;
    if ((RETRYABLE_SQLSTATES as readonly string[]).includes(code)) return true;

    // P2010 (requête brute) : le SQLSTATE n'existe que dans le message.
    const message = typeof candidate?.message === "string"
        ? candidate.message
        : error instanceof Error
            ? error.message
            : "";
    return /code:\s*`?(40001|40P01)\b/i.test(message)
        || /could not serialize access|deadlock detected/i.test(message);
}

export interface WriteConflictRetryOptions {
    /** Nombre total de tentatives (≥ 1). */
    attempts?: number;
    /** Prédicat de rejeu (injectable dans les tests). */
    isRetryable?: (error: unknown) => boolean;
    /** Attente avant la tentative suivante (injectable dans les tests). */
    waitBeforeRetry?: (attempt: number) => Promise<void>;
}

/**
 * Exécute `run` et la rejoue **uniquement** sur conflit d'écriture, au plus
 * `attempts` fois. Toute autre erreur remonte immédiatement ; la dernière erreur
 * est relancée telle quelle quand les tentatives sont épuisées.
 */
export async function retryOnWriteConflict<T>(
    run: () => Promise<T>,
    options: WriteConflictRetryOptions = {}
): Promise<T> {
    const attempts = Math.max(1, Math.floor(options.attempts ?? WRITE_CONFLICT_ATTEMPTS));
    const isRetryable = options.isRetryable ?? isWriteConflict;
    const waitBeforeRetry = options.waitBeforeRetry ?? (async (attempt: number) => {
        await new Promise((resolve) => setTimeout(resolve, attempt * 10));
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await run();
        } catch (error) {
            lastError = error;
            if (!isRetryable(error) || attempt === attempts) throw error;
            await waitBeforeRetry(attempt);
        }
    }
    throw lastError;
}
