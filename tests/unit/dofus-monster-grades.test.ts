/**
 * Chantier « Raccord DofusDB », lot **R-2** — lecture des résistances d'un grade de monstre.
 *
 * 🐛 Mesure du 15/10/2026 : la même information arrive sous **trois** formes selon l'écran (notre base
 * `resists`, un amont `resistances`, ou **rien**), et chaque écran bricolait sa lecture
 * (`grade?.resists || {}`) ⇒ un payload légèrement différent faisait **disparaître les valeurs sans
 * aucune erreur** (cas mesuré : l'écran « avis de recherche » affiche Tacle/Fuite mais aucune
 * résistance).
 *
 * 🛡️ Ce que ce test protège : une lecture **unique** et **tolérante**, et surtout **fail-closed**
 * (aucune valeur exploitable ⇒ `null` — jamais cinq résistances à « 0 % » inventées).
 */

import { describe, expect, it } from "vitest";
import { readGradeResists } from "@/lib/dofus-monster-grades";

describe("readGradeResists", () => {
    it("lit la forme de NOTRE base (grades[].resists)", () => {
        expect(readGradeResists({ resists: { neutral: 54, fire: 34, earth: 34, water: -26, air: -26 } })).toEqual({
            neutral: 54,
            earth: 34,
            fire: 34,
            water: -26,
            air: -26,
        });
    });

    it("lit aussi la forme longue `resistances` (payloads amont)", () => {
        expect(readGradeResists({ resistances: { neutral: 10, earth: 20 } })).toEqual({
            neutral: 10,
            earth: 20,
            fire: null,
            water: null,
            air: null,
        });
    });

    it("accepte une chaîne numérique et arrondit", () => {
        const resists = readGradeResists({ resists: { neutral: "54", fire: 33.6 } });
        expect(resists?.neutral).toBe(54);
        expect(resists?.fire).toBe(34);
    });

    it("fail-closed : aucune valeur exploitable ⇒ null (jamais des zéros inventés)", () => {
        expect(readGradeResists({})).toBeNull();
        expect(readGradeResists({ resists: {} })).toBeNull();
        expect(readGradeResists({ resists: { neutral: "abc", fire: null } })).toBeNull();
        expect(readGradeResists({ resists: null })).toBeNull();
        expect(readGradeResists(null)).toBeNull();
        expect(readGradeResists("nope")).toBeNull();
        expect(readGradeResists([1, 2])).toBeNull();
    });

    it("une seule valeur présente suffit (et les autres restent null)", () => {
        const resists = readGradeResists({ resists: { air: -26 } });
        expect(resists).toEqual({ neutral: null, earth: null, fire: null, water: null, air: -26 });
    });
});
