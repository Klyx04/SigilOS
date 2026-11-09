import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-data-collection";

const read = (rel: string) => readFileSync(rel, "utf8");

/**
 * Migration `@sentry/nextjs` 10 → 11 (09/11/2026).
 *
 * En v11, `sendDefaultPii` disparaît au profit de `dataCollection`, dont les **défauts
 * collectent cookies, en-têtes, corps de requêtes, paramètres d'URL et variables locales**.
 * Ces verrous empêchent une régression silencieuse : un profil ouvert enverrait des secrets
 * à Sentry sans qu'aucun autre test ne s'en aperçoive.
 */
describe("Sentry v11 — profil de collecte fermé", () => {
  it("ferme tout ce qui peut porter un secret ou une donnée personnelle", () => {
    expect(SENTRY_DATA_COLLECTION.userInfo).toBe(false);
    expect(SENTRY_DATA_COLLECTION.cookies).toBe(false);
    expect(SENTRY_DATA_COLLECTION.httpHeaders).toBe(false);
    expect(SENTRY_DATA_COLLECTION.httpBodies).toEqual([]);
    expect(SENTRY_DATA_COLLECTION.urlQueryParams).toBe(false);
    expect(SENTRY_DATA_COLLECTION.databaseQueryData).toBe(false);
    expect(SENTRY_DATA_COLLECTION.stackFrameVariables).toBe(false);
    expect(SENTRY_DATA_COLLECTION.genAI).toEqual({ inputs: false, outputs: false });
    expect(SENTRY_DATA_COLLECTION.mcp).toEqual({ inputs: false, outputs: false });
    expect(SENTRY_DATA_COLLECTION.graphQL).toEqual({ document: false, variables: false });
  });

  it("les trois runtimes l'appliquent — aucun ne retombe sur les défauts v11", () => {
    for (const file of [
      "sentry.server.config.ts",
      "sentry.edge.config.ts",
      "src/instrumentation-client.ts",
    ]) {
      const src = read(file);
      expect(src, file).toContain("dataCollection: SENTRY_DATA_COLLECTION");
      // `sendDefaultPii` n'existe plus en v11 : sa présence signalerait un reste de v10.
      expect(src, file).not.toContain("sendDefaultPii");
    }
  });

  it("le wrapper de config est importé depuis son point d'entrée v11", () => {
    const src = read("next.config.ts");
    expect(src).toContain('from "@sentry/nextjs/config"');
    expect(src).not.toContain('withSentryConfig } from "@sentry/nextjs"');
  });
});
