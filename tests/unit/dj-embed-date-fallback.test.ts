/**
 * Embed — la date est OPTIONNELLE, le champ ne doit jamais disparaître.
 *
 * Verrou : « Sans date pour l'instant » doit être écrit quand aucune date n'a été
 * fixée (post DJ simple, post DJ multi, run Songes). Un champ absent est ambigu :
 * le lecteur ne peut pas distinguer « aucune date prévue » d'un oubli de l'embed.
 *
 * Ce sont des constructeurs d'embed privés (fichiers `"use server"`, dépendants de
 * Prisma/Discord) : on verrouille donc la SOURCE, comme les autres tests d'UI du
 * module (`dungeon-finder-filters-ui`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DJ = "src/server/actions/dungeon-finder-actions.ts";
const SONGES = "src/server/songes-service.ts";

const sansDateCount = (code: string) => (code.match(/"\*Sans date pour l'instant\*"/g) ?? []).length;

describe("Embed — date optionnelle, jamais absente", () => {
    it("post DJ : le champ « Date prévue » est posé dans les deux constructeurs", () => {
        const code = readFileSync(DJ, "utf8");
        // Un constructeur pour le post simple, un pour chaque donjon du post multi
        // (le picto vient de `emo()` : emoji d'application ou repli unicode).
        expect((code.match(/\$\{emo\("dofus_date"\)\} Date prévue/g) ?? []).length).toBe(2);
        expect(sansDateCount(code)).toBe(2);
    });

    it("run Songes : le champ « Date & Heure » est posé aussi sans date", () => {
        const code = readFileSync(SONGES, "utf8");
        expect((code.match(/\$\{emo\("dofus_date"\)\} Date & Heure/g) ?? []).length).toBe(1);
        expect(sansDateCount(code)).toBe(1);
    });

    it("le repli est en italique (lisible dans l'embed, distinct d'une vraie date)", () => {
        const dj = readFileSync(DJ, "utf8");
        const songes = readFileSync(SONGES, "utf8");
        expect(dj).toMatch(/value: dungeonDateStamp[\s\S]{0,200}?"\*Sans date pour l'instant\*"/);
        expect(songes).toMatch(/value: run\.scheduledAt[\s\S]{0,300}?"\*Sans date pour l'instant\*"/);
    });
});
