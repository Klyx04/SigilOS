/**
 * `perf-web` P1-1 — preuve d'exécution du correctif RSC.
 *
 * Sentry est initialisé pour de vrai, avec un **transport mémoire** (aucun réseau).
 * On simule ensuite le scope du rendu RSC (`setClient(undefined)`) : sans le
 * rattachement du client enregistré au démarrage, `startSpan` rendrait un span non
 * enregistré et aucune enveloppe ne serait émise (mesure du 20/11/2026 en bêta).
 */
import { describe, expect, it } from "vitest";
import * as Sentry from "@sentry/nextjs";
import type { Envelope } from "@sentry/core";

import { registerSentryClient } from "@/lib/perf-client";
import { withSpan } from "@/lib/perf-span";

const envelopes: Envelope[] = [];

const client = Sentry.init({
    dsn: "https://public@example.com/1",
    enabled: true,
    tracesSampleRate: 1,
    environment: "test",
    transport: () => ({
        send: async (envelope: Envelope) => {
            envelopes.push(envelope);
            return {};
        },
        flush: async () => true,
    }),
});

registerSentryClient(client);

describe("withSpan — exécution réelle (transport mémoire)", () => {
    it("émet le span même quand le scope courant n'a pas de client (RSC)", async () => {
        // Simule le scope isolé du rendu RSC : le client n'y est pas.
        Sentry.getCurrentScope().setClient(undefined);

        const value = await withSpan("dashboard.layout.getUserContext", "function", async () => 42);

        expect(value).toBe(42);
        await client?.flush(2000);

        const serialized = JSON.stringify(envelopes);
        expect(serialized).toContain("dashboard.layout.getUserContext");
    });
});
