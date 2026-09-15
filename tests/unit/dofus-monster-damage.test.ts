import { describe, it, expect } from "vitest";
import {
    NO_DAMAGE_BONUS,
    damageElementOfEffect,
    damageStatsFromDofensiveGrade,
    pickMonsterDamageStats,
    scaleDamageDice,
    scaleDamageEffect,
    scaleDamageInEffectGroups,
} from "@/lib/dofus-monster-damage";

/**
 * Payload RÉEL Dofensive — sort 12131 « Râle d'Agonie » d'Agonie la Déterrée (5684),
 * relevé le 15/09/2026 (`/spells/12131?lang=fr`). Les jets du payload sont BRUTS
 * (74 à 86 puis 12 à 14 pour le poison) ; Dofensive affiche 666 à 774 et 108 à 126.
 */
const AGONIE_GRADES = [
    { Id: 1, Level: 200, PrimaryCharacteristics: { LifePoints: 9900, Strength: 800, Intelligence: 800, Chance: 800, Agility: 800, Wisdom: 634 } },
    { Id: 2, Level: 200, PrimaryCharacteristics: { Strength: 500, Intelligence: 500, Chance: 500, Agility: 500 } },
];

const raleEffect = (duration: number) => ({
    Id: 98,
    Name: "#1{ à #2|~2} dommages Air",
    TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_AIR",
    Type: 1,
    Duration: duration,
    Parameters: duration === 0
        ? [{ Name: "74", Type: 1, Function: 5, Value: 74 }, { Name: "86", Type: 1, Function: 5, Value: 86 }]
        : [{ Name: "12", Type: 1, Function: 5, Value: 12 }, { Name: "14", Type: 1, Function: 5, Value: 14 }],
});

const AGONIE_GROUP = [{ Id: 0, Effects: [raleEffect(0), raleEffect(3)] }];

/** Rendu minimal d'un gabarit (`#1{ à #2|~2} dommages Air`) — suffit pour prouver le label final. */
function renderTemplate(name: string, params: Array<{ Name?: unknown }> = []): string {
    return String(name)
        .replace(/\{([^}|]*)\|([^}]*)\}/g, (_m, a: string, b: string) => (a.trim() ? a : b.replace(/^~/, "")))
        .replace(/#(\d+)/g, (_m, n: string) => String(params[Number(n) - 1]?.Name ?? ""))
        .replace(/\s+/g, " ")
        .trim();
}

describe("dofus-monster-damage — calcul de dégâts des sorts de monstre (parité Dofensive)", () => {
    it("scaleDamageDice : floor(jet × (1 + stat/100)) — les valeurs de Dofensive sont reproduites", () => {
        // Agonie la Déterrée : Agilité 800 ⇒ ×9 → « Râle d'Agonie » 74-86 devient 666-774.
        expect(scaleDamageDice(74, 800)).toBe(666);
        expect(scaleDamageDice(86, 800)).toBe(774);
        // Poison (pour 3 tours) : 12-14 → 108-126 (valeurs affichées par Dofensive).
        expect(scaleDamageDice(12, 800)).toBe(108);
        expect(scaleDamageDice(14, 800)).toBe(126);
        // Terre 48-56 avec Force 800.
        expect(scaleDamageDice(48, 800)).toBe(432);
        // Stat non ronde : arrondi BAS (même convention que la fiche DofusDB).
        expect(scaleDamageDice(43, 700)).toBe(344);
        // Aucun bonus / stat invalide ⇒ jet inchangé.
        expect(scaleDamageDice(74, 0)).toBe(74);
        expect(scaleDamageDice(74, Number.NaN)).toBe(74);
        expect(scaleDamageDice(74, -50)).toBe(74);
    });

    it("damageElementOfEffect : lit le label technique, le suffixe d'élément et le repli Neutre", () => {
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_AIR" })).toBe("air");
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_EARTH" })).toBe("earth");
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_FIRE" })).toBe("fire");
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_WATER" })).toBe("water");
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_NEUTRAL" })).toBe("neutral");
        // Sans suffixe = Neutre (mesuré sur « Épicentre » → « dommages Neutre »).
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST" })).toBe("neutral");
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_STEAL_FROM_AIR" })).toBe("air");
        // Ce qui n'est PAS un dommage direct : jamais calculé.
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_BOOST_DEALT_DAMAGE_PERCENT_MULTIPLIER" })).toBeNull();
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_DEBOOST_RECEIVED_DAMAGE_PERCENT_MULTIPLIER_DISTANCE" })).toBeNull();
        expect(damageElementOfEffect({ TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST_PERCENT_FROM_AIR" })).toBeNull();
        // Repli sur le libellé localisé (label absent).
        expect(damageElementOfEffect({ Name: "#1{ à #2|~2} dommages Air" })).toBe("air");
        expect(damageElementOfEffect({ Name: "Vol de vie Neutre" })).toBe("neutral");
        expect(damageElementOfEffect({ Name: "20% Dommages finaux" })).toBeNull();
        expect(damageElementOfEffect({ Name: "Dommages poussée: 12" })).toBeNull();
        expect(damageElementOfEffect(null)).toBeNull();
    });

    it("scaleDamageEffect : jets recalculés (Name + Value) SANS muter le payload source", () => {
        const source = raleEffect(0);
        const snapshot = JSON.stringify(source);
        const scaled = scaleDamageEffect(source, { ...NO_DAMAGE_BONUS, air: 800 });

        expect(JSON.stringify(source)).toBe(snapshot); // aucune mutation
        expect(scaled.Parameters.map((p: any) => p.Name)).toEqual(["666", "774"]);
        expect(scaled.Parameters.map((p: any) => p.Value)).toEqual([666, 774]);
        // Le reste de l'effet est préservé (label technique, durée, type…).
        expect(scaled.TechnicalLabel).toBe("ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_AIR");
        expect(scaled.Duration).toBe(0);
    });

    it("scaleDamageEffect : Neutre non boosté et effets non-dégâts intacts (identité)", () => {
        const neutral = {
            Name: "#1{ à #2|~2} dommages Neutre",
            TechnicalLabel: "ACTION_CHARACTER_LIFE_POINTS_LOST",
            Parameters: [{ Name: "28", Value: 28 }, { Name: "32", Value: 32 }],
        };
        expect(scaleDamageEffect(neutral, { earth: 800, fire: 800, water: 800, air: 800, neutral: 0 })).toBe(neutral);

        const boost = {
            Name: "#1% Dommages finaux",
            TechnicalLabel: "ACTION_CHARACTER_BOOST_DEALT_DAMAGE_PERCENT_MULTIPLIER",
            Parameters: [{ Name: "20", Value: 20 }],
        };
        expect(scaleDamageEffect(boost, { ...NO_DAMAGE_BONUS, air: 800 })).toBe(boost);
    });

    it("scaleDamageInEffectGroups : « Râle d'Agonie » affiche 666 à 774 puis 108 à 126 (comme Dofensive)", () => {
        // Grade 1 = celui du sort de départ (Agilité 800 ⇒ ×9, valeurs publiées par Dofensive).
        const stats = pickMonsterDamageStats(AGONIE_GRADES, 1);
        expect(stats).toEqual({ earth: 800, fire: 800, water: 800, air: 800, neutral: 0 });

        const scaled = scaleDamageInEffectGroups(AGONIE_GROUP, stats);
        const labels = scaled
            .flatMap((g: any) => g.Effects)
            .map((e: any) => renderTemplate(e.Name, e.Parameters));

        expect(labels[0]).toBe("666 à 774 dommages Air");
        expect(labels[1]).toBe("108 à 126 dommages Air"); // poison « pour 3 tours »
        // Le source reste brut (74 à 86) : aucune écriture dans le payload Dofensive.
        expect(renderTemplate(AGONIE_GROUP[0].Effects[0].Name, AGONIE_GROUP[0].Effects[0].Parameters)).toBe("74 à 86 dommages Air");
    });

    it("pickMonsterDamageStats : grade demandé, repli dernier grade, données absentes", () => {
        expect(pickMonsterDamageStats(AGONIE_GRADES, 1)).toEqual({ earth: 800, fire: 800, water: 800, air: 800, neutral: 0 });
        expect(pickMonsterDamageStats(AGONIE_GRADES, 2)).toEqual({ earth: 500, fire: 500, water: 500, air: 500, neutral: 0 });
        // Grade hors bornes / non fourni ⇒ dernier grade (= grade max, comportement des fiches).
        expect(pickMonsterDamageStats(AGONIE_GRADES, 99)).toEqual({ earth: 500, fire: 500, water: 500, air: 500, neutral: 0 });
        expect(pickMonsterDamageStats(AGONIE_GRADES)).toEqual({ earth: 500, fire: 500, water: 500, air: 500, neutral: 0 });
        expect(pickMonsterDamageStats([], 1)).toEqual(NO_DAMAGE_BONUS);
        expect(pickMonsterDamageStats(null)).toEqual(NO_DAMAGE_BONUS);
    });

    it("damageStatsFromDofensiveGrade : mapping Terre=Force, Feu=Intelligence, Eau=Chance, Air=Agilité", () => {
        expect(damageStatsFromDofensiveGrade({ PrimaryCharacteristics: { Strength: 120, Intelligence: 340, Chance: 560, Agility: 780 } }))
            .toEqual({ earth: 120, fire: 340, water: 560, air: 780, neutral: 0 });
        // Négatif/absent ⇒ 0 (jamais de malus appliqué).
        expect(damageStatsFromDofensiveGrade({ PrimaryCharacteristics: { Strength: -20 } }))
            .toEqual({ earth: 0, fire: 0, water: 0, air: 0, neutral: 0 });
        expect(damageStatsFromDofensiveGrade(null)).toEqual(NO_DAMAGE_BONUS);
    });
});
