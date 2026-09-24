/**
 * Persistance de l'état des siphons game-data (Redis).
 *
 * ⚠️ **Serveur uniquement** (importe `@/lib/redis` → `ioredis` → `dns`) : ne JAMAIS
 * l'importer depuis un composant client. Les règles pures et les types vivent dans
 * `@/lib/game-data-sync-state` (client-safe) — c'est ce module-là que consomment
 * les composants.
 *
 * 🐛 Incident du 22/09/2026 : ces fonctions vivaient dans `game-data-sync-state.ts`,
 * importé par `GameDataSyncStatePanel` (composant client) ⇒ le bundler suivait
 * `await import("@/lib/redis")` et échouait sur `Can't resolve 'dns'`. Séparation
 * pure/serveur actée + garde de test.
 *
 * Fail-open : Redis indisponible ⇒ lecture vide / écriture ignorée, jamais d'exception
 * (un siphon ne doit JAMAIS casser parce que l'état est indisponible).
 */

import {
    computePercent,
    emptyGameDataRunState,
    GAME_DATA_DATASETS,
    type GameDataDataset,
    type GameDataRunCounts,
    type GameDataRunState,
} from "@/lib/game-data-sync-state";

const KEY = (dataset: GameDataDataset) => `game-data:sync:${dataset}`;
const TTL_SECONDS = 7 * 24 * 3600;
const REDIS_TIMEOUT_MS = 500;

interface RedisLite {
    get(k: string): Promise<string | null>;
    set(k: string, v: string, mode?: string, ttl?: number): Promise<unknown>;
    mget(...keys: string[]): Promise<(string | null)[]>;
}

/** Redis borné + fail-open (même politique que `dofusdb-limiter`). */
async function withRedis<T>(work: (client: RedisLite) => Promise<T>): Promise<T | null> {
    try {
        const { redis } = await import("@/lib/redis");
        return await Promise.race([
            work(redis as unknown as RedisLite),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), REDIS_TIMEOUT_MS)),
        ]);
    } catch {
        return null;
    }
}

async function readState(dataset: GameDataDataset): Promise<GameDataRunState> {
    const raw = await withRedis((c) => c.get(KEY(dataset)));
    if (!raw) return emptyGameDataRunState(dataset);
    try {
        return { ...emptyGameDataRunState(dataset), ...(JSON.parse(raw) as GameDataRunState), dataset };
    } catch {
        return emptyGameDataRunState(dataset);
    }
}

async function writeState(state: GameDataRunState): Promise<void> {
    await withRedis((c) => c.set(KEY(state.dataset), JSON.stringify(state), "EX", TTL_SECONDS));
}

/** Démarre un run (bouton cliqué en direct, ou job pris par le worker). */
export async function beginGameDataRun(
    dataset: GameDataDataset,
    opts: { total?: number | null; message?: string } = {},
): Promise<void> {
    await writeState({
        ...emptyGameDataRunState(dataset),
        status: "RUNNING",
        total: opts.total ?? null,
        percent: computePercent(0, opts.total ?? null),
        message: opts.message ?? null,
        startedAt: new Date().toISOString(),
    });
}

/** Progression intermédiaire (appelée à chaque lot / race / classe). */
export async function reportGameDataProgress(
    dataset: GameDataDataset,
    patch: { done?: number; total?: number | null; message?: string },
): Promise<void> {
    const current = await readState(dataset);
    const total = patch.total !== undefined ? patch.total : current.total;
    const done = patch.done !== undefined ? patch.done : current.done;
    await writeState({
        ...current,
        status: "RUNNING",
        startedAt: current.startedAt ?? new Date().toISOString(),
        done,
        total: total ?? null,
        percent: computePercent(done, total),
        message: patch.message ?? current.message,
    });
}

/** Fin de run : succès (OK, 100 %) ou échec (ERROR + message lisible). */
export async function finishGameDataRun(
    dataset: GameDataDataset,
    opts: { ok: boolean; message?: string; error?: string; counts?: GameDataRunCounts | null } = { ok: true },
): Promise<void> {
    const current = await readState(dataset);
    await writeState({
        ...current,
        status: opts.ok ? "OK" : "ERROR",
        percent: opts.ok ? 100 : current.percent,
        done: opts.ok && current.total ? current.total : current.done,
        message: opts.message ?? current.message,
        finishedAt: new Date().toISOString(),
        lastError: opts.ok ? null : opts.error ?? current.lastError,
        // Bilan chiffré : écrit seulement quand la passe en fournit un (sinon on conserve le
        // précédent — un échec ne doit pas effacer « 46 modifiés » de la veille réussie).
        counts: opts.ok && opts.counts !== undefined ? opts.counts : current.counts,
    });
}

/**
 * 🔭 **Filigrane de veille** — ce que DofusDB a déjà servi à ce dataset.
 *
 * Persistant (⚠️ **sans TTL**, contrairement à l'état de run) : s'il disparaissait, la
 * veille ciblée retomberait sur une passe complète (correct mais lent). `skip` permet de
 * **reprendre** une passe ciblée interrompue par le plafond, sans jamais sauter d'item.
 */
const WATCH_KEY = (dataset: GameDataDataset) => `game-data:watch:${dataset}`;

export interface GameDataWatchState {
    /** Dernier `updatedAt` distant traité (ISO). */
    since: string | null;
    /** Pagination de reprise (`0` en régime normal). */
    skip: number;
}

export async function getGameDataWatchState(dataset: GameDataDataset): Promise<GameDataWatchState | null> {
    const raw = await withRedis((c) => c.get(WATCH_KEY(dataset)));
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<GameDataWatchState>;
        return { since: typeof parsed.since === "string" ? parsed.since : null, skip: Number(parsed.skip) || 0 };
    } catch {
        return null;
    }
}

export async function setGameDataWatchState(dataset: GameDataDataset, state: GameDataWatchState): Promise<void> {
    await withRedis((c) => c.set(WATCH_KEY(dataset), JSON.stringify(state)));
}

/** Tous les états (un par dataset, jamais `null`) — lu par le tableau du dashboard God. */
export async function getGameDataRunStates(): Promise<GameDataRunState[]> {
    const raw = await withRedis((c) => c.mget(...GAME_DATA_DATASETS.map(KEY)));
    return GAME_DATA_DATASETS.map((dataset, i) => {
        const value = raw?.[i];
        if (!value) return emptyGameDataRunState(dataset);
        try {
            return { ...emptyGameDataRunState(dataset), ...(JSON.parse(value) as GameDataRunState), dataset };
        } catch {
            return emptyGameDataRunState(dataset);
        }
    });
}
