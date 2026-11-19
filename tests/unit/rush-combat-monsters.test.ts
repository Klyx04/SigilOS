import { describe, expect, it } from "vitest";
import {
    cleanRushCombatMonsterName,
    normalizeRushCombatMonsterName,
    resolveRushCombatMonsters,
    splitRushCombatMonsterNames,
    type RushMonsterMap,
} from "@/lib/rush-combat-monsters";
import RUSH_MONSTER_MAP from "@/data/rush-monster-map.json";

/**
 * Règle des monstres de combat — la source Tougli écrit des **groupes**
 * (« A, B, C », parfois `groupe · …`, avec des quantités `×N`). On vérifie ici
 * le découpage, la clé de rapprochement et le refus d'inventer une fiche.
 */
describe("monstres des combats du guide", () => {
    it("découpe un groupe, retire les quantités et le préfixe « groupe »", () => {
        expect(splitRushCombatMonsterNames("Piou Rouge, Piou Bleu ×2, groupe · Chafer")).toEqual([
            "Piou Rouge",
            "Piou Bleu",
            "Chafer",
        ]);
    });

    it("retire aussi le préfixe de mode (« solo · »), déjà porté par le type", () => {
        expect(splitRushCombatMonsterNames("solo · Piou Rouge, tactique · Chafer")).toEqual([
            "Piou Rouge",
            "Chafer",
        ]);
        expect(splitRushCombatMonsterNames("soloV · Piou Rouge, groupeV · Chafer")).toEqual([
            "Piou Rouge",
            "Chafer",
        ]);
    });

    it("ne garde pas un libellé vide (le mot « groupe » seul)", () => {
        expect(splitRushCombatMonsterNames("groupe")).toEqual([]);
        expect(splitRushCombatMonsterNames("  ,  , ")).toEqual([]);
    });

    it("dédoublonne sur la clé normalisée, pas sur la casse", () => {
        expect(splitRushCombatMonsterNames("Bouftou, bouftou, BOUFTOU")).toEqual(["Bouftou"]);
    });

    it("normalise casse, accents, ponctuation et préfixe", () => {
        expect(normalizeRushCombatMonsterName("  Groupe · Abraknyde Sombre Gardien ×3 ")).toBe(
            "abraknyde sombre gardien"
        );
        expect(cleanRushCombatMonsterName("Groupe · Abraknyde Sombre Gardien ×3")).toBe(
            "Abraknyde Sombre Gardien"
        );
    });

    it("résout un nom connu et laisse un inconnu sans fiche", () => {
        const lookup: RushMonsterMap = {
            "piou rouge": { name: "Piou Rouge", slug: "piou-rouge", monsterId: 489, gfxId: 273 },
        };
        expect(resolveRushCombatMonsters("groupe · Piou Rouge, Inconnu", lookup)).toEqual([
            { name: "Piou Rouge", slug: "piou-rouge", monsterId: 489, gfxId: 273 },
            { name: "Inconnu" },
        ]);
    });

    it("borne le nombre de monstres d'un groupe", () => {
        const raw = Array.from({ length: 25 }, (_, index) => `Monstre ${index + 1}`).join(", ");
        expect(splitRushCombatMonsterNames(raw)).toHaveLength(20);
    });

    it("résout les trois noms tronqués de la source via les alias mesurés", () => {
        expect(resolveRushCombatMonsters("Chaffoin le Sourn", RUSH_MONSTER_MAP)[0]?.slug).toBe(
            "chaffoin-le-sournois"
        );
        expect(resolveRushCombatMonsters("Garde Bwork Élémental d'Ai", RUSH_MONSTER_MAP)[0]?.slug).toBe(
            "garde-bwork-elemental-d-air"
        );
        expect(resolveRushCombatMonsters("Aventurier injuri", RUSH_MONSTER_MAP)[0]?.slug).toBe(
            "aventurier-injurieux"
        );
    });
});
