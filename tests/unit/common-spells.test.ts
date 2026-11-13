import { describe, it, expect } from "vitest";
import { COMMON_SPELLS } from "@/lib/common-spells";

describe("COMMON_SPELLS", () => {
    it("contient les sorts communs mesurés au catalogue le 26/10/2026", () => {
        const names = COMMON_SPELLS.map((s) => s.name);
        expect(names).toEqual([
            "Flamiche",
            "Libération",
            "Cawotte",
            "Invocation de Chaferfu",
            "Invocation d'Arakne",
            "Marteau de Moon",
            "Boomerang Perfide",
            "Maîtrise d'Arme",
            "Nécronyx",
        ]);
        // 🧨 « Foudroiement » ne doit pas revenir sans mesure : `GET /spells?name.fr=Foudroiement`
        // renvoie **0** résultat (constat du 26/10/2026). Une entrée inventée = une icône morte.
        expect(names).not.toContain("Foudroiement");
    });

    it("chaque icône pointe l'URL amont officielle `sort_<iconId>` (fin des carrés verts)", () => {
        // 🧨 Les anciennes valeurs (`/api/assets-dofus/spells/371`…) n'étaient ni l'id du sort ni
        // son `iconId` : le proxy répondait 404 puis servait son placeholder (pixel vert).
        // L'URL amont officielle est la SEULE forme que le proxy sait siphonner (`?url=`).
        for (const spell of COMMON_SPELLS) {
            expect(spell.imageUrl).toMatch(/^https:\/\/api\.dofusdb\.fr\/img\/spells\/sort_\d+\.png$/);
        }
    });

    it("les ids locaux restent hors de la plage des sorts de classe (clé d'état React)", () => {
        for (const spell of COMMON_SPELLS) {
            expect(spell.id).toBeGreaterThanOrEqual(99000);
        }
        expect(new Set(COMMON_SPELLS.map((s) => s.id)).size).toBe(COMMON_SPELLS.length);
    });

    it("Flamiche garde ses jets écrits à la main (non siphonnés — reste tracé en ROADMAP)", () => {
        const flamiche = COMMON_SPELLS.find((s) => s.name === "Flamiche");
        expect(flamiche).toBeDefined();
        expect(flamiche?.apCost).toBe(2);
        expect(flamiche?.maxRange).toBe(6);
        expect(flamiche?.damages[0].min).toBe(9);
        expect(flamiche?.damages[0].max).toBe(11);
        // La description, elle, est officielle : Flamiche tape dans le **meilleur élément**.
        expect(flamiche?.description).toContain("meilleur élément");
    });
});
