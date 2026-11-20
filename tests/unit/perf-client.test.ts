/**
 * `perf-client` — référence au client Sentry du serveur, partagée entre bundles.
 *
 * Le rendu RSC ne porte pas le client sur son scope : `perf-span` a besoin de le
 * retrouver pour que `startSpan` enregistre réellement le span (`docs/plans/PERF-WEB.md` §3.1).
 */
import { describe, expect, it } from "vitest";

import { getRegisteredSentryClient, registerSentryClient } from "@/lib/perf-client";

type SentryClient = Parameters<typeof registerSentryClient>[0];

describe("perf-client — référence au client Sentry", () => {
    it("rend le client enregistré au démarrage", () => {
        const client = { id: "client-serveur" } as unknown as SentryClient;

        registerSentryClient(client);

        expect(getRegisteredSentryClient()).toBe(client);
    });

    it("n'écrase pas la référence si l'init ne rend pas de client", () => {
        const client = { id: "client-serveur" } as unknown as SentryClient;
        registerSentryClient(client);

        registerSentryClient(undefined);

        expect(getRegisteredSentryClient()).toBe(client);
    });
});
