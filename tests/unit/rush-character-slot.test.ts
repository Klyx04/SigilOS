import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { resolveRushCharacterSlot } from "@/lib/rush-character-slot";

/**
 * Slot de personnage du guide Rush.
 *
 * Mesure du 25/11/2026 : la mule « Wylan » avait le même pseudo que le principal.
 * `altPseudo === pseudoDofus` repliait la mule sur `PRINCIPAL` : elle affichait et
 * réinitialisait la progression du principal, jamais son slot `Wylan` (6 blocs).
 */

describe("slot de personnage — une mule déclarée gagne même homonyme", () => {
    it("reconnaît la mule homonyme du personnage principal", () => {
        expect(
            resolveRushCharacterSlot({
                altPseudo: "Wylan",
                mainPseudo: "Wylan",
                mules: [{ pseudo: "Wylan" }, { pseudo: "Darkfeudala" }],
            })
        ).toBe("Wylan");
    });

    it("traite PRINCIPAL comme le personnage principal", () => {
        expect(resolveRushCharacterSlot({ altPseudo: "PRINCIPAL", mainPseudo: "Wylan", mules: [] })).toBeUndefined();
        expect(resolveRushCharacterSlot({ altPseudo: null, mainPseudo: "Wylan", mules: [] })).toBeUndefined();
        expect(resolveRushCharacterSlot({ altPseudo: "  ", mainPseudo: "Wylan", mules: [] })).toBeUndefined();
    });

    it("garde le repli des anciennes URL avec le pseudo du principal", () => {
        expect(
            resolveRushCharacterSlot({ altPseudo: "Wylan", mainPseudo: "Wylan", mules: [] })
        ).toBeUndefined();
    });

    it("reconnaît une autre mule déclarée", () => {
        expect(
            resolveRushCharacterSlot({
                altPseudo: " Darkfeudala ",
                mainPseudo: "Wylan",
                mules: [{ pseudo: "Wylan" }, { pseudo: "Darkfeudala" }],
            })
        ).toBe("Darkfeudala");
    });

    it("laisse passer un emplacement inconnu sans l'inventer ailleurs", () => {
        expect(
            resolveRushCharacterSlot({ altPseudo: "Inconnu", mainPseudo: "Wylan", mules: [] })
        ).toBe("Inconnu");
    });
});

const CLIENT = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("slot de personnage — branchement", () => {
    it("le guide utilise la règle pour effectiveAltPseudo", () => {
        const code = read(CLIENT);
        expect(code).toContain("resolveRushCharacterSlot");
        expect(code).toContain("const effectiveAltPseudo=useMemo(()=>resolveRushCharacterSlot");
        // Le reset, le panneau Dofus et les écritures lisent tous le slot effectif.
        expect(code).toContain("resetGuideProgress(guildId,guide.id,effectiveAltPseudo)");
        expect(code).toContain('activeCharacterSlot={effectiveAltPseudo ?? "PRINCIPAL"}');
    });
});
