/**
 * `getTelemetryStats` — la sélection de guilde est résolue côté serveur.
 *
 * Le bug d'origine : le sélecteur envoie `GuildConfig.id` (CUID) alors que les
 * événements stockent le snowflake de l'URL. La lecture doit filtrer les **deux**
 * espaces, et une sélection inconnue doit renvoyer un résultat vide sans requête.
 * Les tables de profils, elles, ne connaissent que l'id interne.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ACTIONS = "src/server/actions/telemetry-actions.ts";

describe("getTelemetryStats — portée de guilde", () => {
    const source = readFileSync(ACTIONS, "utf8");
    const statsFn = source.slice(
        source.indexOf("export async function getTelemetryStats"),
        source.indexOf("const liveEventsSchema"),
    );

    it("résout la sélection dans les deux espaces et filtre par ids", () => {
        expect(statsFn).toContain("resolveTelemetryGuildScope");
        expect(statsFn).toContain("guildId: { in: scope.ids }");
        expect(statsFn).toContain("emptyTelemetryStats");
    });

    it("utilise l'id interne pour les tables de profils", () => {
        expect(statsFn).toContain("internalGuildId");
        expect(statsFn).not.toContain("where: { guildId: filterGuildId }");
    });

    it("l'export utilise la même règle", () => {
        const exportFn = source.slice(source.indexOf("export async function exportTelemetryDataAction"));
        expect(exportFn).toContain("resolveTelemetryGuildScope");
        expect(exportFn).toContain("guildId: { in: scope.ids }");
    });
});
