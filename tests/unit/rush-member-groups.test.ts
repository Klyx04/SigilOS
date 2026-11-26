import { describe, expect, it } from "vitest";

import {
    groupDofusMembersByOwner,
    primaryDofusMember,
} from "@/lib/rush-dofus-progress";

/**
 * Densité des fiches Dofus (26/11/2026) : une quête listait un personnage par
 * ligne, mules comprises. On regroupe par **compte** ; le `+N` du groupe porte
 * le détail. La règle est pure, donc testable sans rendu.
 */

const member = (name: string, muleOf: string | null = null) => ({ name, muleOf });

describe("groupDofusMembersByOwner — un compte, une ligne", () => {
    it("regroupe les mules sous leur principal et conserve l'ordre d'apparition", () => {
        const groups = groupDofusMembersByOwner([
            member("Wylan"),
            member("Ikhellwa"),
            member("Liappunov", "Ikhellwa"),
            member("Lafrapp-de-Chine", "Ikhellwa"),
        ]);

        expect(groups.map((group) => group.owner)).toEqual(["Wylan", "Ikhellwa"]);
        expect(groups[1].members.map((m) => m.name)).toEqual([
            "Ikhellwa",
            "Liappunov",
            "Lafrapp-de-Chine",
        ]);
    });

    it("rattache une mule vue avant son principal au même groupe", () => {
        const groups = groupDofusMembersByOwner([
            member("Liappunov", "Ikhellwa"),
            member("Ikhellwa"),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].owner).toBe("Ikhellwa");
        expect(groups[0].members.map((m) => m.name)).toEqual(["Liappunov", "Ikhellwa"]);
    });

    it("choisit le principal comme représentant, sinon le premier personnage", () => {
        expect(primaryDofusMember([member("Liappunov", "Ikhellwa"), member("Ikhellwa")])?.name).toBe(
            "Ikhellwa"
        );
        expect(primaryDofusMember([member("Liappunov", "Ikhellwa")])?.name).toBe("Liappunov");
        expect(primaryDofusMember([])).toBeNull();
    });

    it("ne mute pas la liste d'entrée et ignore un nom vide", () => {
        const input = [member("Wylan"), member("")];
        const before = JSON.stringify(input);
        const groups = groupDofusMembersByOwner(input);

        expect(JSON.stringify(input)).toBe(before);
        expect(groups.map((group) => group.owner)).toEqual(["Wylan"]);
    });
});
