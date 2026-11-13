/**
 * Suppression de la page morte « Stats Guilde » — **verrou de non-régression**.
 *
 * Phase 1 : page, 14 composants, catalogue, sidebar, tour et couverture documentaire.
 * Phase 2a : clé `stats` retirée du registre (`ModuleKey`/`GuildModulesState`/`DEFAULT_MODULES`),
 * du Zod, de `module-actions` et de `user-actions` ; `canViewStats` retiré.
 * Phase 2b : **colonne `GuildModules.stats` supprimée** (migration `20270125000300`), restes de
 * compatibilité retirés (`RETIRED_MODULE_KEYS`, libellé legacy) et asset orphelin supprimé.
 * Ce qui reste **volontairement** : `getGuildStats` + `QuickStatsRow` (accueil du dashboard).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MODULE_GROUPS, moduleLabel } from "@/lib/module-catalog";
import { DEFAULT_MODULES } from "@/lib/module-types";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const MIGRATION = "prisma/migrations/20270125000300_drop_guild_modules_stats/migration.sql";

/**
 * Bloc du modèle Prisma `GuildModules`. Indispensable : `stats` existe aussi dans d'autres
 * modèles (`MonsterStat.stats`, `MarketListing.stats`) — une recherche globale se tromperait.
 */
function guildModulesModel(): string {
    const match = read("prisma/schema.prisma").match(/model GuildModules \{[\s\S]*?\n\}/);
    if (!match) throw new Error("modèle GuildModules introuvable dans prisma/schema.prisma");
    return match[0];
}

describe("page Stats Guilde — supprimée sans casser l'accueil", () => {
    it("le dossier de la page et ses composants n'existent plus", () => {
        expect(fs.existsSync(path.join(ROOT, "src/app/dashboard/[guildId]/stats"))).toBe(false);
    });

    it("le catalogue ne propose plus le module et n'a plus de libellé legacy", () => {
        const keys = MODULE_GROUPS.flatMap((group) => group.modules.map((module) => module.key));
        expect(keys).not.toContain("stats");
        expect(moduleLabel("stats")).toBe("stats");
        expect(moduleLabel("pas-un-module")).toBe("pas-un-module");
        expect(read("src/lib/module-catalog.ts")).not.toContain("LEGACY_MODULE_LABELS");
        expect(read("src/lib/module-catalog.ts")).not.toContain("Stats Guilde");
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

    it("le schéma ne porte plus la colonne GuildModules.stats (Phase 2b)", () => {
        expect(guildModulesModel()).not.toMatch(/\bstats\s+Boolean/);
        // Garde-fou de lecture : le bloc extrait est bien celui du modèle.
        expect(guildModulesModel()).toContain("disabledByGod");
    });

    it("la migration supprime la colonne, une seule fois, et dit qu'elle est irréversible", () => {
        expect(fs.existsSync(path.join(ROOT, MIGRATION))).toBe(true);
        const sql = read(MIGRATION);
        expect(sql).toContain('ALTER TABLE "GuildModules" DROP COLUMN IF EXISTS "stats";');
        expect(sql).toMatch(/IRR[ÉE]VERSIBLE/i);
        expect(sql).not.toContain("DROP TABLE");
    });

    it("plus aucun reste de compatibilité pour un module retiré", () => {
        expect(read("src/lib/module-types.ts")).not.toContain("RETIRED_MODULE_KEYS");
        expect(read("src/server/actions/telemetry-product-actions.ts")).not.toContain("RETIRED_MODULE_KEYS");
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

    it("l'asset orphelin a disparu et n'est plus mappé", () => {
        expect(fs.existsSync(path.join(ROOT, "public/assets/dofus/modules/guildActivity.png"))).toBe(false);
        expect(read("src/lib/module-catalog.ts")).not.toContain("guildActivity");
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
