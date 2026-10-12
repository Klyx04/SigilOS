import { describe, expect, it } from "vitest";
import { deriveDofensiveMonsterName, pickDofensiveMonsterId, resolveMonsterKey } from "@/lib/dofensive-boss";

describe("deriveDofensiveMonsterName", () => {
    it("extrait le monstre d'un double boss « Comte et Klime »", () => {
        expect(deriveDofensiveMonsterName("Comte et Klime")).toBe("klime");
        expect(deriveDofensiveMonsterName("Comte et Sylargh")).toBe("sylargh");
        expect(deriveDofensiveMonsterName("Comte et Missiz Frizz")).toBe("missiz frizz");
        expect(deriveDofensiveMonsterName("Comte et Nileza")).toBe("nileza");
    });

    it("retourne null pour un nom simple (pas de « et » séparateur)", () => {
        expect(deriveDofensiveMonsterName("Comte Harebourg")).toBeNull();
        expect(deriveDofensiveMonsterName("Donjon du Comte Harebourg")).toBeNull();
        expect(deriveDofensiveMonsterName("")).toBeNull();
        expect(deriveDofensiveMonsterName(null)).toBeNull();
    });

    it("gère les variantes « & » et « + »", () => {
        expect(deriveDofensiveMonsterName("Comte & Klime")).toBe("klime");
        expect(deriveDofensiveMonsterName("Comte + Klime")).toBe("klime");
    });
});

describe("resolveMonsterKey", () => {
    it("privilégie le dofensiveMonsterName explicite", () => {
        expect(resolveMonsterKey("Missiz Frizz", "Comte et Klime")).toBe("missiz frizz");
    });

    it("dérive depuis le nom affiché si le champ est absent", () => {
        expect(resolveMonsterKey(null, "Comte et Klime")).toBe("klime");
        expect(resolveMonsterKey(undefined, "Comte et Sylargh")).toBe("sylargh");
    });
});

describe("pickDofensiveMonsterId — le monstre demandé, pas le boss", () => {
    /** Famille réelle du donjon « Fers de la Tyrannie » (boss = Servitude). */
    const FAMILY = [
        { id: 3416, name: "Servitude" },
        { id: 3384, name: "Tambourreau" },
        { id: 3391, name: "Rossignol" },
    ];
    const BOSS = 3416;

    it("régression : un monstre de salle ne prend PLUS l'ID du boss", () => {
        // Avant le correctif, on retournait toujours `bossMonsterId` ⇒ « Tambourreau »
        // affichait les sorts de « Servitude ».
        expect(pickDofensiveMonsterId(FAMILY, "Tambourreau", BOSS)).toBe(3384);
        expect(pickDofensiveMonsterId(FAMILY, "Tambourreau", BOSS)).not.toBe(BOSS);
    });

    it("reste juste pour le boss lui-même (entité principale)", () => {
        expect(pickDofensiveMonsterId(FAMILY, "Servitude", BOSS)).toBe(BOSS);
    });

    it("ignore casse, accents et apostrophes typographiques", () => {
        const family = [
            { id: 10, name: "Rose Démoniaque" },
            { id: 11, name: "Pissenlit Diabolique" },
        ];
        expect(pickDofensiveMonsterId(family, "rose demoniaque", BOSS)).toBe(10);
        expect(pickDofensiveMonsterId(family, "PISSENLIT DIABOLIQUE", BOSS)).toBe(11);
        expect(pickDofensiveMonsterId([{ id: 12, name: "Vilain Petit Porkass" }], "Vilain Petit Porkass", BOSS)).toBe(12);
    });

    it("accepte une correspondance partielle NON ambiguë (« Kardorim » ↔ nom plus long)", () => {
        const family = [{ id: 20, name: "Kardorim le Ténébreux" }, { id: 21, name: "Autre Monstre" }];
        expect(pickDofensiveMonsterId(family, "Kardorim", BOSS)).toBe(20);
    });

    it("en cas d'ambiguïté (familles d'invocations), retient le nom le plus proche", () => {
        const family = [
            { id: 30, name: "Tursoel Sauvage" },
            { id: 31, name: "Tursoel Affamé Cinquième" },
        ];
        // « Tursoel » est contenu dans les deux → on garde le plus proche en longueur.
        expect(pickDofensiveMonsterId(family, "Tursoel", BOSS)).toBe(30);
    });

    it("replie sur le boss quand le nom demandé est absent de la famille (nommage différent)", () => {
        expect(pickDofensiveMonsterId(FAMILY, "Nom Inconnu De DofusDB", BOSS)).toBe(BOSS);
        expect(pickDofensiveMonsterId([], "Tambourreau", BOSS)).toBe(BOSS);
        expect(pickDofensiveMonsterId(null, "Tambourreau", BOSS)).toBe(BOSS);
    });

    it("retourne null si rien n'est exploitable (pas de famille ni de boss)", () => {
        expect(pickDofensiveMonsterId([], "Tambourreau", null)).toBeNull();
        expect(pickDofensiveMonsterId([], "Tambourreau", undefined)).toBeNull();
        expect(pickDofensiveMonsterId([], "Tambourreau", 0)).toBeNull();
    });

    it("ignore les entrées sans ID valide", () => {
        const family = [{ id: Number.NaN, name: "Fantôme" }, { id: 44, name: "Tambourreau" }];
        expect(pickDofensiveMonsterId(family as any, "Tambourreau", BOSS)).toBe(44);
        expect(pickDofensiveMonsterId(family as any, "Fantôme", BOSS)).toBe(BOSS);
    });
});
