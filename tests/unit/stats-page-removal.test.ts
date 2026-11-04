/**
 * Suppression de la page morte « Stats Guilde » — **verrou de non-régression**.
 *
 * Phase 1 : page, 14 composants, catalogue, sidebar, tour et couverture documentaire.
 * Phase 2a : clé `stats` retirée du registre (`ModuleKey`/`GuildModulesState`/`DEFAULT_MODULES`),
 * du Zod, de `module-actions` et de `user-actions` ; `canViewStats` retiré.
 * Ce qui est **conservé** : `getGuildStats` + `QuickStatsRow` (accueil), la **colonne**
 * `GuildModules.stats` (rollback sûr, aucune migration), `RETIRED_MODULE_KEYS` et le
 * libellé legacy pour les données historiques.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MODULE_GROUPS, moduleLabel } from "@/lib/module-catalog";
import { DEFAULT_MODULES, RETIRED_MODULE_KEYS } from "@/lib/module-types";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("page Stats Guilde — supprimée sans casser l'accueil", () => {
    it("le dossier de la page et ses composants n'existent plus", () => {
        expect(fs.existsSync(path.join(ROOT, "src/app/dashboard/[guildId]/stats"))).toBe(false);
    });

    it("le catalogue ne propose plus le module, mais garde son libellé historique", () => {
        const keys = MODULE_GROUPS.flatMap((group) => group.modules.map((module) => module.key));
        expect(keys).not.toContain("stats");
        expect(RETIRED_MODULE_KEYS.has("stats")).toBe(true);
        expect(moduleLabel("stats")).toBe("Stats Guilde");
        expect(moduleLabel("pas-un-module")).toBe("pas-un-module");
    });

    it("la clé stats a quitté le registre et le RBAC (Phase 2a)", () => {
        expect("stats" in DEFAULT_MODULES).toBe(false);
        expect(read("src/lib/module-types.ts")).not.toContain('| "stats"');
        expect(read("src/server/actions/module-actions.ts")).not.toContain("stats: z.boolean");
        expect(read("src/server/actions/module-actions.ts")).not.toContain("dbModules.stats");
        expect(read("src/server/actions/user-actions.ts")).not.toContain("canViewStats");
        expect(read("src/server/actions/user-actions.ts")).not.toContain("mod?.stats");
        expect(read("src/components/layout/app-sidebar.tsx")).not.toContain("canViewStats");
    });

    it("la colonne GuildModules.stats reste en base (aucune migration, rollback sûr)", () => {
        expect(read("prisma/schema.prisma")).toMatch(/model GuildModules[\s\S]*?stats\s+Boolean\s+@default\(true\)/);
    });

    it("plus aucun lien /stats dans la sidebar, le tour ou l'admin des modules", () => {
        for (const file of [
            "src/components/layout/app-sidebar.tsx",
            "src/components/tour/tour-provider.tsx",
            "src/components/tour/module-tour-replay-button.tsx",
            "src/app/dashboard/[guildId]/admin/modules/_components/modules-client.tsx",
        ]) {
            expect(read(file), `${file} contient encore /stats`).not.toContain("/stats");
        }
    });

    it("la télémétrie exclut les modules retirés", () => {
        expect(read("src/server/actions/telemetry-product-actions.ts")).toContain("RETIRED_MODULE_KEYS");
    });

    it("l'accueil du dashboard garde getGuildStats et QuickStatsRow", () => {
        const dashboard = read("src/app/dashboard/[guildId]/page.tsx");
        expect(dashboard).toContain("getGuildStats");
        expect(dashboard).toContain("QuickStatsRow");
        expect(read("src/server/actions/guild-stats-actions.ts")).toContain("export async function getGuildStats");
    });

    it("la couverture documentaire ne référence plus stats", () => {
        expect(read("src/lib/docs-modules.ts")).not.toContain('stats: { member: "stats" }');
    });
});
