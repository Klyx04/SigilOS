/**
 * Métriques système — parseurs purs + requêtes Prometheus internes.
 *
 * Aucune de ces fonctions n'expose de secret : on ne renvoie que des nombres
 * agrégés. Prometheus est joint **en interne** (`http://prometheus:9090`) et
 * jamais exposé publiquement.
 */

import { z } from "zod";

const prometheusResponseSchema = z.object({
    status: z.literal("success"),
    data: z.object({
        resultType: z.string(),
        result: z.array(
            z.object({
                metric: z.record(z.string(), z.string()).optional(),
                value: z.tuple([z.number(), z.string()]).optional(),
            }),
        ),
    }),
});

/** Extrait la première valeur scalaire d'une réponse Prometheus. */
export function parsePrometheusScalar(payload: unknown): number | null {
    const parsed = prometheusResponseSchema.safeParse(payload);
    if (!parsed.success) return null;

    const raw = parsed.data.data.result[0]?.value?.[1];
    if (raw === undefined) return null;

    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

export type PrometheusResult = { value: number | null; error: string | null };

/** Interroge Prometheus en interne, avec timeout court et échec non bloquant. */
export async function queryPrometheus(
    query: string,
    options: { url?: string; timeoutMs?: number } = {},
): Promise<PrometheusResult> {
    const base = (options.url ?? process.env.PROMETHEUS_URL ?? "http://prometheus:9090").replace(/\/+$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 1500);

    try {
        const response = await fetch(`${base}/api/v1/query?query=${encodeURIComponent(query)}`, {
            signal: controller.signal,
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
        if (!response.ok) return { value: null, error: `HTTP ${response.status}` };

        const value = parsePrometheusScalar(await response.json());
        return value === null ? { value: null, error: "Réponse vide" } : { value, error: null };
    } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return { value: null, error: aborted ? "Timeout" : "Prometheus indisponible" };
    } finally {
        clearTimeout(timeout);
    }
}

export type RedisInfo = {
    usedMemoryMb: number | null;
    maxMemoryMb: number | null;
    evictedKeys: number;
    connectedClients: number;
    hitRatePercent: number | null;
};

function readInfoField(info: string, key: string): string | null {
    const match = info.match(new RegExp(`^${key}:(.+)$`, "m"));
    return match ? match[1].trim() : null;
}

/** Parse la sortie `INFO` de Redis sans exposer de valeur sensible. */
export function parseRedisInfo(info: string): RedisInfo {
    const bytesToMb = (raw: string | null): number | null => {
        if (!raw) return null;
        const bytes = Number(raw);
        return Number.isFinite(bytes) ? Math.round((bytes / (1024 * 1024)) * 10) / 10 : null;
    };

    const usedMemoryMb = bytesToMb(readInfoField(info, "used_memory"));
    const maxMemoryMb = bytesToMb(readInfoField(info, "maxmemory"));
    const hits = Number(readInfoField(info, "keyspace_hits") ?? 0);
    const misses = Number(readInfoField(info, "keyspace_misses") ?? 0);
    const total = hits + misses;

    return {
        usedMemoryMb,
        maxMemoryMb: maxMemoryMb !== null && maxMemoryMb > 0 ? maxMemoryMb : null,
        evictedKeys: Number(readInfoField(info, "evicted_keys") ?? 0) || 0,
        connectedClients: Number(readInfoField(info, "connected_clients") ?? 0) || 0,
        hitRatePercent: total > 0 ? Math.round((hits / total) * 1000) / 10 : null,
    };
}