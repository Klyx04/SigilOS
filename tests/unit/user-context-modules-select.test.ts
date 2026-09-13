/**
 * Régression (13/09) — **le contexte utilisateur doit lire TOUS les modules**.
 *
 * Bug corrigé : `getUserContext()` ne sélectionnait pas `marche` (ni
 * `reactionRoles`, `tickets`, `commandes`, `admin`) dans
 * `guildConfig.modules` ⇒ `mod.marche` valait `undefined` ⇒
 * `applyModule(false, perm)` renvoyait **false pour tout le monde sauf le God**
 * (`bypassModules`), alors que le module était bien activé en base.
 *
 * Symptôme observé : le module Marché n'apparaissait que pour le God, et tout
 * autre utilisateur (même le propriétaire Discord) recevait « Accès Restreint ».
 *
 * Ce test lit la source et vérifie que **chaque** clé de `GuildModulesState` est
 * présente dans le `select` — toute nouvelle clé oubliée casse le test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_MODULES } from "@/lib/module-types";

const USER_ACTIONS = "src/server/actions/user-actions.ts";

/** Contenu du `modules: { select: { ... } }` du contexte utilisateur. */
function modulesSelectSource(): string {
    const source = readFileSync(USER_ACTIONS, "utf8");
    const match = source.match(/modules:\s*\{\s*select:\s*\{([^}]*)\}/);
    expect(match, "bloc `modules: { select: … }` introuvable dans getUserContext").not.toBeNull();
    return match![1];
}

describe("getUserContext — lecture exhaustive des modules (régression « Accès Restreint »)", () => {
    it("sélectionne CHAQUE clé de GuildModulesState", () => {
        const block = modulesSelectSource();
        const selected = new Set([...block.matchAll(/(\w+)\s*:\s*true/g)].map((m) => m[1]));

        for (const key of Object.keys(DEFAULT_MODULES)) {
            expect(selected.has(key), `module non lu par getUserContext : ${key}`).toBe(true);
        }
    });

    it("lit bien `marche` (le module était activable mais invisible)", () => {
        expect(modulesSelectSource()).toMatch(/\bmarche\s*:\s*true/);
    });

    it("lit aussi les modules dont l'absence bloquait l'accès (tickets, reactionRoles, commandes)", () => {
        const block = modulesSelectSource();
        for (const key of ["tickets", "reactionRoles", "commandes"]) {
            expect(block, `module non lu : ${key}`).toMatch(new RegExp(`\\b${key}\\s*:\\s*true`));
        }
    });
});
