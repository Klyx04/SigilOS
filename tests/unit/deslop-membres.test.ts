/**
 * Garde du déslop du module **Membres** (chantier B, lot B-1).
 *
 * Baseline mesurée avant la refonte (28/09/2026) — c'est ce que cette garde interdit de
 * réintroduire dans les fichiers de la refonte :
 * - titres en double (`italic`, `tracking-[0.2em]`, `font-black`) ;
 * - rayons gonflés (`rounded-xl` / `rounded-2xl`) ;
 * - halos (`blur-[100px]`), flous (`backdrop-blur`), ombres (`shadow-2xl`) ;
 * - remplissages colorés décoratifs (`bg-info/`, `bg-warning/`, `bg-success/`, `bg-danger/`) ;
 * - animations d'entrée (`animate-in`, `slide-in-from`) ;
 * - `confirm()` natif (remplacé par une confirmation `AlertDialog`).
 *
 * Le **tour** est verrouillé en plus : les deux ancres réelles existent, et le pointeur fantôme
 * `admin-members-tools` (cible inexistante, étape de visite morte) ne revient pas.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const REFONTE_FILES = [
    "src/components/admin/members/member-management.tsx",
    "src/components/admin/members/member-roster-list.tsx",
    "src/components/admin/members/member-detail-dialog.tsx",
    "src/app/dashboard/[guildId]/admin/members/page.tsx",
];

const FORBIDDEN = [
    "rounded-xl",
    "rounded-2xl",
    "rounded-3xl",
    "glass-premium",
    "bg-black/",
    "animate-in",
    "slide-in-from",
    "bg-gradient",
    "blur-[",
    "backdrop-blur",
    "shadow-2xl",
    "font-black",
    "italic",
    "tracking-widest",
    "tracking-[0.2em]",
    "bg-info/",
    "bg-warning/",
    "bg-success/",
    "bg-danger/",
    "confirm(",
    "console.log",
];

describe("déslop du module Membres (chantier B)", () => {
    it("n'introduit aucun marqueur de slop dans les fichiers de la refonte", () => {
        for (const file of REFONTE_FILES) {
            const content = readFileSync(file, "utf8");
            for (const marker of FORBIDDEN) {
                expect(content, `${file} contient « ${marker} »`).not.toContain(marker);
            }
        }
    });

    it("aucun emoji dans un libellé structurant (onglets Membres / Blacklist)", () => {
        const tabs = readFileSync("src/components/admin/members/member-management.tsx", "utf8");
        expect(tabs).not.toContain("👥");
        expect(tabs).not.toContain("🚫");
        expect(tabs).toContain("Membres");
        expect(tabs).toContain("Blacklist");
    });

    it("conserve les ancres réelles de la visite et supprime le pointeur fantôme", () => {
        const page = readFileSync("src/app/dashboard/[guildId]/admin/members/page.tsx", "utf8");
        expect(page).toContain('data-tour="admin-members-header"');
        expect(page).toContain('data-tour="admin-members-table"');

        const tour = readFileSync("src/components/tour/tour-provider.tsx", "utf8");
        expect(tour).not.toContain("admin-members-tools");
        expect(tour).toContain('data-tour="admin-members-header"');
        expect(tour).toContain('data-tour="admin-members-table"');
    });

    it("la liste unifiée passe bien par les règles pures (aucun filtre maison)", () => {
        const list = readFileSync("src/components/admin/members/member-roster-list.tsx", "utf8");
        expect(list).toContain("queryRoster(");
        expect(list).toContain("rosterCounts(");
        expect(list).toContain("rosterRoleOptions(");
    });
});
