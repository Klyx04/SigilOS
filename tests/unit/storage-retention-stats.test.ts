/**
 * God « Stockage » — compteurs de rétention (télémétrie 90 j / journal
 * d'activité 365 j). Lecture seule : aucune purge manuelle depuis l'écran.
 *
 * Le calcul vit dans l'action déjà gardée (`isSuperAdmin`), pas dans le
 * composant : un client ne doit jamais pouvoir demander un compteur sans garde.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("God Stockage — compteurs de rétention", () => {
    const action = readFileSync("src/server/actions/storage-actions.ts", "utf8");
    const panel = readFileSync("src/components/admin/storage-overview-panel.tsx", "utf8");

    it("l'action reste super-admin et mesure les deux tables (count + plus ancienne ligne)", () => {
        const start = action.indexOf("export async function getGuildLogsStats");
        const end = action.indexOf("export async function getGodTranscriptsList");
        const block = action.slice(start, end);

        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        expect(block).toContain("isSuperAdmin");
        expect(block).toContain("db.telemetryEvent.count");
        expect(block).toContain("db.serviceActivityLog.count");
        expect(block).toContain("aggregate");
        expect(block).toContain("_min");
        expect(block).toContain("LOG_RETENTION_DAYS");
        expect(block).not.toContain("$queryRaw");
    });

    it("le panneau affiche les deux tuiles, la plus ancienne ligne et la purge à venir", () => {
        expect(panel).toContain("Télémétrie");
        expect(panel).toContain("Journal d'activité");
        expect(panel).toContain("Plus ancienne ligne");
        expect(panel).toContain("Purge au prochain cron");
        expect(panel).toContain("logs.retention.policy");
    });

    it("les tuiles restent en lecture seule (aucun bouton de suppression)", () => {
        const start = panel.indexOf('{activeTab === "logs" && logs && (');
        const end = panel.indexOf("{/* Orphans Modal */}");
        const block = panel.slice(start, end);

        expect(start).toBeGreaterThan(-1);
        expect(block).not.toContain("godDelete");
        expect(block).not.toContain("deleteMany");
    });
});
