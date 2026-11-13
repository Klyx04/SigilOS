/**
 * Sondages — déduplication question / description dans l'embed (règle pure).
 *
 * Constat (13/11/2026) : le titre de l'embed est déjà la question, en
 * majuscules. Quand le créateur recopiait la question dans « Description »,
 * l'embed affichait deux fois la même phrase (titre + citation). La règle
 * ignore casse, espaces multiples et ponctuation finale — l'exemple réel de la
 * capture (« … farming ? » en titre, « … farming » en description) doit être
 * reconnu comme un doublon.
 */
import { describe, it, expect } from "vitest";
import { isPollDescriptionRedundant, normalizePollText } from "@/lib/polls/embed-content";

describe("normalizePollText", () => {
    it("ignore la casse, les espaces multiples et la ponctuation finale", () => {
        expect(normalizePollText("  Quelle   refonte ?  ")).toBe("quelle refonte");
        expect(normalizePollText("QUELLE REFONTE")).toBe("quelle refonte");
    });

    it("conserve les accents et normalise en NFC", () => {
        expect(normalizePollText("Événement")).toBe("événement");
    });
});

describe("isPollDescriptionRedundant", () => {
    it("reconnaît la même phrase saisie dans les deux champs", () => {
        expect(
            isPollDescriptionRedundant(
                "Est-ce que ça vous intéresserait qu'on achète le bonus de guilde +50 % butin pour ce week-end afin d'organiser des sessions de farming ?",
                "Est-ce que ça vous intéresserait qu'on achète le bonus de guilde +50 % butin pour ce week-end afin d'organiser des sessions de farming"
            )
        ).toBe(true);
    });

    it("reconnaît un doublon avec retours à la ligne et casse différente", () => {
        expect(isPollDescriptionRedundant("Quelle refonte ?", "QUELLE\nrefonte")).toBe(true);
    });

    it("ne déduplique pas une description qui apporte une information", () => {
        expect(
            isPollDescriptionRedundant(
                "Quelle refonte ?",
                "Trois pistes sont proposées : grades, salons et rôles. Donnez votre avis."
            )
        ).toBe(false);
    });

    it("ne déduplique pas une question contenue dans une description plus longue", () => {
        expect(
            isPollDescriptionRedundant("Quelle refonte ?", "Quelle refonte ? Expliquez votre choix.")
        ).toBe(false);
    });

    it("ne déduplique jamais une description ou un titre vide", () => {
        expect(isPollDescriptionRedundant("Quelle refonte ?", "")).toBe(false);
        expect(isPollDescriptionRedundant("", "Quelle refonte ?")).toBe(false);
        expect(isPollDescriptionRedundant(null, null)).toBe(false);
    });
});
