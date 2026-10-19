import { describe, it, expect } from "vitest";
import { parsePrometheusScalar, parseRedisInfo } from "@/lib/system-metrics";

describe("métriques système", () => {
    it("extrait une valeur scalaire Prometheus", () => {
        const payload = {
            status: "success",
            data: {
                resultType: "vector",
                result: [{ metric: {}, value: [1_700_000_000, "42.5"] }],
            },
        };
        expect(parsePrometheusScalar(payload)).toBe(42.5);
    });

    it("ignore une réponse Prometheus invalide", () => {
        expect(parsePrometheusScalar({ status: "error" })).toBeNull();
        expect(parsePrometheusScalar(null)).toBeNull();
        expect(parsePrometheusScalar({ status: "success", data: { result: "nope" } })).toBeNull();
    });

    it("ignore un résultat Prometheus vide", () => {
        const payload = { status: "success", data: { resultType: "vector", result: [] } };
        expect(parsePrometheusScalar(payload)).toBeNull();
    });

    it("parse la mémoire Redis, les clients et le taux de hit", () => {
        const info = [
            "used_memory:104857600",
            "maxmemory:209715200",
            "evicted_keys:3",
            "connected_clients:7",
            "keyspace_hits:90",
            "keyspace_misses:10",
        ].join("\n");

        expect(parseRedisInfo(info)).toEqual({
            usedMemoryMb: 100,
            maxMemoryMb: 200,
            evictedKeys: 3,
            connectedClients: 7,
            hitRatePercent: 90,
        });
    });

    it("retombe sur des valeurs neutres quand Redis ne fournit rien", () => {
        expect(parseRedisInfo("")).toEqual({
            usedMemoryMb: null,
            maxMemoryMb: null,
            evictedKeys: 0,
            connectedClients: 0,
            hitRatePercent: null,
        });
    });
});