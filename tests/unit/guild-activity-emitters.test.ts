/**
 * Chantier **N**, lot **N-2a** — les **3 émetteurs** d'activité de guilde doivent rester branchés.
 *
 * 🛡️ Ce que ce test protège (verrou de **câblage**, pas de rendu) :
 * ① **Donjons** : la clôture d'un post écrit une ligne (`kind: "donjons"`) — et **une seule**, pas
 *    une par participant ;
 * ② **Songes** : **seule** une run terminée s'annonce (`if (success)`) — un échec n'est pas une
 *    histoire à raconter ;
 * ③ **Dofus** : l'annonce est conditionnée à la **transition** vers 100 % (jamais à chaque quête) ;
 * ④ aucun module n'écrit `ServiceActivityLog` à la main : tout passe par l'émetteur unique.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

const DJ = "src/server/actions/dungeon-finder-actions.ts";
const SONGES = "src/server/actions/songes/dream-run-actions.ts";
const DOFUS = "src/server/actions/dofus-quest-actions.ts";
const EMITTER = "src/server/guild-activity-emit.ts";

describe("émetteurs d'activité de guilde (N-2a)", () => {
    it("donjons : une ligne par post clôturé, avec le nom du donjon", () => {
        const code = source(DJ);
        expect(code).toContain('import { emitGuildActivity } from "@/server/guild-activity-emit"');
        expect(code).toContain('kind: "donjons"');
        expect(code).toContain("entityId: postId");
        expect(code).toContain("detail: post.dungeon?.name ?? null");
    });

    it("songes : seule une run terminée s'annonce", () => {
        const code = source(SONGES);
        expect(code).toContain('kind: "songes"');
        expect(code).toContain("if (success) {");
        expect(code).toContain("entityId: runId");
    });

    it("dofus : annoncé uniquement sur la transition vers 100 %", () => {
        const code = source(DOFUS);
        expect(code).toContain('kind: "dofus"');
        expect(code).toContain("completionPercent === 100 && (previous?.completionPercent ?? 0) < 100");
    });

    it("aucun module n'écrit le journal d'activité à la main (un seul émetteur)", () => {
        for (const path of [DJ, SONGES, DOFUS]) {
            expect(source(path)).not.toContain("serviceActivityLog.create");
        }
        expect(source(EMITTER)).toContain("logServiceActivity");
    });

    it("l'émetteur est fail-closed : sans acteur identifiable, il n'écrit rien", () => {
        const code = source(EMITTER);
        expect(code).toContain("if (!profile) return;");
        expect(code).toContain("catch (error)");
    });
});
