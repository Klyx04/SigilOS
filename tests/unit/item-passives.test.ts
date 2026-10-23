/**
 * Passifs d'objets — catalogue **officiel** (DofusDB `/spells`, siphon `scripts/siphon-item-passives.mjs`).
 *
 * Ce que ces verrous interdisent :
 *  · un texte **inventé** quand la source manque (l'ancien repli Prysmaradite disait
 *    « Effet tactique déclenché lors du premier tour » pour tous les objets) ;
 *  · l'affichage du code brut `sp <id>-<grade>` du payload Dofusbook.
 */

import { describe, it, expect } from "vitest";
import {
    OFFICIAL_PASSIVE_COUNT,
    cleanPassiveMarkup,
    resolvePassiveText,
    resolvePassiveName,
    resolveItemPassive,
    getPassiveDescription,
    hasUnresolvedPassive,
} from "@/lib/dofus-passives";

describe("catalogue officiel des passifs", () => {
    it("contient le sort passif du Dofus Turquoise (5952) avec son texte officiel", () => {
        expect(OFFICIAL_PASSIVE_COUNT).toBeGreaterThan(100);
        expect(resolvePassiveName(5952)).toBe("Dofus Turquoise");
        expect(resolvePassiveText(5952)).toContain("coup critique");
    });

    it("nettoie l'en-tête et les balises DofusDB sans perdre le texte", () => {
        const cleaned = cleanPassiveMarkup(
            "{{spell,5952,1::Bleu Turquoise}} :\n• Lorsque le porteur effectue un coup critique, il gagne 1% de dommages finaux.",
        );
        expect(cleaned).toBe("• Lorsque le porteur effectue un coup critique, il gagne 1% de dommages finaux.");
    });

    it("ne rend jamais une chaîne vide (un texte sans contenu vaut null)", () => {
        expect(cleanPassiveMarkup("{{spell,1,1::Vide}}")).toBeNull();
        expect(cleanPassiveMarkup(null)).toBeNull();
        expect(resolvePassiveText(0)).toBeNull();
        expect(resolvePassiveText(999999)).toBeNull();
    });
});

describe("résolution sur un objet de build", () => {
    it("le code `sp` (min = id du sort) suffit : aucun affichage brut", () => {
        const resolved = resolveItemPassive({
            name: "Objet inconnu",
            effects: [{ code: "sp", min: 5952, max: 1 }],
        });
        expect(resolved?.source).toBe("spell");
        expect(resolved?.spellId).toBe(5952);
        expect(resolved?.text).toContain("coup critique");
    });

    it("retombe sur le nom de l'objet quand le build n'expose pas `sp`", () => {
        const resolved = resolveItemPassive({ name: "Dofus Turquoise", effects: [] });
        expect(resolved?.source).toBe("spell");
        expect(resolved?.text).toContain("dommages finaux");
    });

    it("ne fabrique jamais de texte : un objet sans source renvoie null", () => {
        expect(resolveItemPassive({ name: "Prysmaradite Imaginaire", effects: [] })).toBeNull();
        expect(resolveItemPassive(null)).toBeNull();
        expect(hasUnresolvedPassive({ name: "Objet", effects: [{ code: "sp", min: 999999, max: 1 }] })).toBe(true);
    });

    it("le repli manuel reste disponible (Dofus connu) mais n'est pas présenté comme officiel", () => {
        const manual = getPassiveDescription("dofus ebene");
        expect(manual).toContain("Ébène");
    });

    it("les Prysmaradites n'ont plus de pouvoir passif inventé", () => {
        expect(getPassiveDescription("Prysmaradite de test")).toBeNull();
        expect(resolveItemPassive({ name: "Prysmaradite de test", effects: [] })).toBeNull();
    });
});
