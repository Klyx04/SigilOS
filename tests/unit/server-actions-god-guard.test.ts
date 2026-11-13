import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Verrou AUD-01 / AUD-02 (audit 13/11/2026).
 *
 * Ces invariants sont **statiques** parce que la faille était structurelle :
 * une fonction exportée d'un fichier `"use server"` est un endpoint POST.
 * Le test empêche la réintroduction de l'action publique `notifyGod` et
 * l'oubli de garde sur les actions du panneau God.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** Extrait chaque `export async function name(...)` avec son corps jusqu'au suivant. */
function exportedFunctions(source: string): { name: string; body: string }[] {
    const re = /export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(/g;
    const matches = [...source.matchAll(re)];
    return matches.map((m, i) => {
        const start = m.index ?? 0;
        const end = i + 1 < matches.length ? (matches[i + 1].index ?? source.length) : source.length;
        return { name: m[1], body: source.slice(start, end) };
    });
}

describe("AUD-01/AUD-02 — actions God gardées", () => {
    it("god-notif-actions.ts n'exporte jamais notifyGod (action publique)", () => {
        const src = read("src/server/actions/god-notif-actions.ts");
        expect(src).not.toMatch(/export\s+async\s+function\s+notifyGod/);
        expect(src).not.toMatch(/export\s*\{[^}]*\bnotifyGod\b/);
    });

    it("chaque action exportée du panneau God vérifie l'accès God", () => {
        const src = read("src/server/actions/god-notif-actions.ts");
        const fns = exportedFunctions(src);
        expect(fns.length).toBeGreaterThanOrEqual(4);
        for (const fn of fns) {
            expect(fn.body, `${fn.name} doit appeler hasGodPanelAccess()`).toContain("hasGodPanelAccess");
        }
    });

    it("le moteur notifyGod vit dans un module serveur SANS \"use server\"", () => {
        const src = read("src/server/god-notifications.ts");
        // Une directive est une **ligne** `"use server";` — pas une mention en commentaire.
        const directive = /^\s*["']use server["']\s*;?\s*$/m;
        expect(directive.test(src)).toBe(false);
        expect(src).toMatch(/export\s+async\s+function\s+notifyGod/);
    });

    it("les points d'entrée client mesurés n'importent plus le moteur serveur", () => {
        for (const rel of [
            "src/components/missions/proof-upload-dialog.tsx",
            "src/lib/safety-client.ts",
        ]) {
            expect(read(rel), `${rel} ne doit pas importer god-notifications`).not.toContain(
                "@/server/god-notifications",
            );
        }
    });

    it("reportSecurityIncident vérifie l'appartenance avant d'écrire", () => {
        const src = read("src/server/actions/audit-actions.ts");
        const fn = exportedFunctions(src).find((f) => f.name === "reportSecurityIncident");
        expect(fn, "reportSecurityIncident introuvable").toBeTruthy();
        expect(fn!.body).toMatch(/getUserContext\(guildId\)/);
        expect(fn!.body).toMatch(/ctx\.isMember/);
    });
});
