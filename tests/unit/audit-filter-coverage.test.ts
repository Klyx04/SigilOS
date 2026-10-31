/**
 * Couverture du journal d'audit — 31/10/2026.
 *
 * Mesure : **78** actions déclarées dans `AuditAction`, mais la page guilde
 * (`/admin/logs`) n'offrait que **8** groupes de filtre, et **~36** actions n'étaient dans
 * **aucun** groupe : les lignes existaient en base, l'écran ne permettait pas de les trouver
 * (« il manque des logs »). Cause : une copie locale de la liste au lieu de la taxonomie
 * partagée.
 *
 * Verrou : toute action déclarée doit être dans un groupe de `AUDIT_ACTION_FILTER_OPTIONS`.
 * Une action nouvelle non classée fait échouer ce test — c'est volontaire (règle §Taxonomie).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { AUDIT_ACTION_FILTER_OPTIONS } from "@/lib/audit-taxonomy";

const ACTIONS_SRC = readFileSync(join(process.cwd(), "src/server/actions/audit-actions.ts"), "utf8");
const CLIENT = readFileSync(
    join(process.cwd(), "src/app/dashboard/[guildId]/admin/logs/_components/audit-logs-client.tsx"),
    "utf8",
);

function declaredActions(): string[] {
    const start = ACTIONS_SRC.indexOf("export type AuditAction");
    const block = ACTIONS_SRC.slice(start, ACTIONS_SRC.indexOf(";", start));
    return [...block.matchAll(/"([A-Z_]{5,})"/g)].map((m) => m[1]);
}

function filterGroups(): Set<string> {
    return new Set(
        AUDIT_ACTION_FILTER_OPTIONS.flatMap((option) => option.value.split(","))
            .map((value) => value.trim())
            .filter(Boolean),
    );
}

describe("journal d'audit — toute action écrite est filtrable", () => {
    it("aucune action déclarée n'est absente des filtres", () => {
        const groups = filterGroups();
        const missing = declaredActions().filter((action) => !groups.has(action));
        expect(missing).toEqual([]);
    });

    it("chaque action n'apparaît que dans un seul groupe (pas de doublon trompeur)", () => {
        const seen = new Map<string, number>();
        for (const option of AUDIT_ACTION_FILTER_OPTIONS) {
            for (const value of option.value.split(",")) {
                const key = value.trim();
                seen.set(key, (seen.get(key) ?? 0) + 1);
            }
        }
        const duplicated = [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key);
        expect(duplicated).toEqual([]);
    });

    it("la page guilde consomme la taxonomie partagée (pas une copie locale)", () => {
        expect(CLIENT).toContain('from "@/lib/audit-taxonomy"');
        expect(CLIENT).toContain("...AUDIT_ACTION_FILTER_OPTIONS.map");
    });
});
