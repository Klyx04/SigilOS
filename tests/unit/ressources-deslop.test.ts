/**
 * Déslop 10/10/2026 — module Ressources : chrome plat sur tokens + gouvernance God-only.
 *
 * Verrous :
 *  1. plus de slop visuel (violet codé en dur, dégradés, flous géants, motion, ombres
 *     géantes, rayons arbitraires) dans les 7 fichiers du module ;
 *  2. gouvernance : diffusion toutes guildes SUPPRIMÉE (news), gestion créateurs/liens
 *     SUPPRIMÉE du dashboard (tout vit côté God), permission « Gérer les Ressources »
 *     SUPPRIMÉE du RBAC (gate God-only côté serveur).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const codeOnly = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const SCOPED = [
    "src/components/ressources/ResourcesTabs.tsx",
    "src/components/ressources/ItemSearchPanel.tsx",
    "src/components/ressources/NewsGrid.tsx",
    "src/components/ressources/CreatorsWidget.tsx",
    "src/components/ressources/UsefulLinksGrid.tsx",
    "src/components/ressources/GuidesGrid.tsx",
    "src/app/dashboard/[guildId]/ressources/page.tsx",
];

const SLOP_PATTERNS = [
    "violet-500",
    "violet-400",
    "violet-300",
    "violet-600",
    "purple-",
    "linear-gradient",
    "radial-gradient",
    "blur-3xl",
    "blur-2xl",
    "backdrop-blur-3xl",
    "backdrop-blur-2xl",
    "backdrop-blur-xl",
    "shadow-2xl",
    "rounded-[",
    "bg-clip-text",
    "animate-in",
    "layoutId",
    "framer-motion",
    "tracking-[0.2em]",
    "tracking-[0.15em]",
    "scale-[1",
    "#13171A",
    "135deg",
];

describe("ressources — zéro slop visuel (tokens uniquement)", () => {
    for (const file of SCOPED) {
        it(`${file} : aucun motif slop`, () => {
            const code = codeOnly(read(file));
            const hits = SLOP_PATTERNS.filter((pattern) => code.includes(pattern));
            expect(hits).toEqual([]);
        });
    }
});

describe("ressources — gouvernance God-only (décision 10/10/2026)", () => {
    it("news : diffusion toutes guildes supprimée (composant + action serveur)", () => {
        const grid = codeOnly(read("src/components/ressources/NewsGrid.tsx"));
        expect(grid).not.toMatch(/broadcastNewsToAllGuilds/);
        expect(grid).not.toMatch(/BROADCAST/);
        expect(grid).not.toMatch(/Megaphone/);
        expect(grid).not.toMatch(/confirmBroadcast/);
        const actions = codeOnly(read("src/server/actions/news-discord-actions.ts"));
        expect(actions).not.toMatch(/broadcastNewsToAllGuilds/);
    });

    it("créateurs/liens : aucune gestion dans le dashboard (ni boutons, ni modales, ni confirm)", () => {
        for (const file of [
            "src/components/ressources/CreatorsWidget.tsx",
            "src/components/ressources/UsefulLinksGrid.tsx",
        ]) {
            const code = codeOnly(read(file));
            expect(code).not.toMatch(/CategoryModal|LinkModal/);
            expect(code).not.toMatch(/confirm\(/);
            expect(code).not.toMatch(/upsertContentCreator|deleteContentCreator/);
            expect(code).not.toMatch(/upsertResourceCategory|deleteResourceCategory/);
            expect(code).not.toMatch(/upsertResourceLink|deleteResourceLink/);
            expect(code).not.toMatch(/isSuperAdmin/);
            expect(code).not.toMatch(/canManage/);
        }
    });

    it("RBAC : la permission « Gérer les Ressources » n'existe plus nulle part", () => {
        for (const file of [
            "src/lib/permissions.ts",
            "src/server/actions/user-actions.ts",
            "src/server/actions/resources-actions.ts",
        ]) {
            const code = codeOnly(read(file));
            expect(code).not.toMatch(/RESOURCES_MANAGE/);
            expect(code).not.toMatch(/resources:manage/);
            expect(code).not.toMatch(/canManageResources/);
        }
        // …et la garde serveur est God-only (fail-closed, sans branche RBAC).
        const guards = codeOnly(read("src/server/actions/resources-actions.ts"));
        expect(guards).toContain("await isSuperAdmin();");
        expect(guards).toContain("la gestion des ressources se fait côté God");
    });
});
