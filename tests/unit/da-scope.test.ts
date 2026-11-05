import { describe, expect, it } from "vitest";
import { daScopeProps } from "@/lib/da-scope";

/**
 * Portée de la DA pour les surfaces sorties de l'arbre — **règle pure**.
 *
 * Mesure du 05/11/2026 : Radix porte les `DialogContent` dans `document.body`,
 * donc hors de la coque `data-da`. Sans portée, les modales du Rush retombaient
 * sur les jetons produit (153 occurrences) ; et un repli « sombre + Émeraude »
 * par défaut repeignait les modales partagées par des écrans non migrés.
 *
 * Ce que ces cas verrouillent, dans l'ordre où les défauts ont été mesurés :
 *   · hors fournisseur ⇒ AUCUNE portée (jamais un thème inventé) ;
 *   · bloc nommé ⇒ pas d'accent libre (la règle de `resolveRushDaTheme`) ;
 *   · accent libre ⇒ HEX strict, jamais une valeur injectable en CSS.
 */
describe("portée de la DA — daScopeProps", () => {
    it("hors d'une surface de la DA, la règle ne pose rien du tout", () => {
        expect(daScopeProps(null)).toEqual({});
        expect(daScopeProps(undefined)).toEqual({});
    });

    it("un bloc nommé pose les trois attributs, sans accent", () => {
        expect(daScopeProps({ theme: "dark", block: "emeraude" })).toEqual({
            "data-da": "wakfu",
            "data-theme": "dark",
            "data-block": "emeraude",
        });
    });

    it("le mode clair est transmis tel quel", () => {
        const props = daScopeProps({ theme: "light", block: "ocre" });
        expect(props["data-theme"]).toBe("light");
        expect(props["data-block"]).toBe("ocre");
    });

    it("un bloc nommé ignore l'accent libre (le nommé gagne, comme dans la règle de bloc)", () => {
        const props = daScopeProps({ theme: "dark", block: "cauchemar", accent: "#e9a93a" });
        expect(props.style).toBeUndefined();
    });

    it("un bloc `custom` porte son accent sur la portée", () => {
        const props = daScopeProps({ theme: "dark", block: "custom", accent: "#4A2C6B" });
        expect(props["data-block"]).toBe("custom");
        expect(props.style).toEqual({ "--da-acc": "#4A2C6B" });
    });

    it("un accent qui n'est pas un HEX à six chiffres est refusé (aucune injection CSS)", () => {
        for (const accent of ["red", "#fff", "#12345", "url(x)", "#1234567", "  #123456"]) {
            const props = daScopeProps({ theme: "dark", block: "custom", accent });
            expect(props.style, accent).toBeUndefined();
        }
    });

    it("un accent absent ou nul ne laisse pas de style vide", () => {
        expect(daScopeProps({ theme: "dark", block: "custom" }).style).toBeUndefined();
        expect(daScopeProps({ theme: "dark", block: "custom", accent: null }).style).toBeUndefined();
    });
});
