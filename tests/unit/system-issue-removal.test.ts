/**
 * Nettoyage final de la fusion — plus aucun code applicatif ne lit `SystemIssue`.
 *
 * Le script d'exploitation (`scripts/migrate-system-issues-to-support-tickets.ts`)
 * reste hors de `src/` : il est la seule trace de la source historique et ne
 * compile plus contre le client Prisma. `legacySystemIssueId` reste une colonne
 * de traçabilité de `SupportTicket`, pas une référence au modèle supprimé.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(directory: string): string[] {
    return readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

describe("Suppression de SystemIssue", () => {
    it("aucun fichier de src ne référence le modèle ou le client supprimé", () => {
        const sources = walk("src").filter((file) => /\.(ts|tsx)$/.test(file));
        const offenders = sources.filter((file) => {
            const content = readFileSync(file, "utf8");
            return /\bSystemIssue\b/.test(content) || /db\.systemIssue/.test(content);
        });
        expect(offenders).toEqual([]);
    });

    it("le schéma Prisma ne porte plus le modèle ni l'enum de type", () => {
        const schema = readFileSync("prisma/schema.prisma", "utf8");
        expect(schema).not.toMatch(/model SystemIssue\b/);
        expect(schema).not.toMatch(/enum SystemIssue/);
        expect(schema).toMatch(/enum TrackerStatus\b/);
        expect(schema).toMatch(/trackerStatus\s+TrackerStatus\?/);
    });

    it("la migration destructive supprime la table source", () => {
        const migration = readFileSync(
            "prisma/migrations/20270202000000_drop_system_issue/migration.sql",
            "utf8",
        );
        expect(migration).toMatch(/ALTER TYPE "SystemIssueStatus" RENAME TO "TrackerStatus"/);
        expect(migration).toMatch(/DROP TABLE IF EXISTS "SystemIssue"/);
        expect(migration).toMatch(/DROP TYPE IF EXISTS "SystemIssueType"/);
    });
});
