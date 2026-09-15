import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ANOMALY_COMPANION_FAMILY_ID,
    ANOMALY_COMPANION_PICK,
    ANOMALY_COMPANION_RACE_IDS,
    ANOMALY_RACE_ID,
    DEFAULT_ANOMALY_MAP,
    anomalyCompanionHint,
    buildAnomalyDungeonName,
    buildAnomalyMonsterPool,
    groupAnomalyGuardiansByMap,
    isAnomalyBossDungeon,
    isAnomalyCompanion,
    orderAnomalyCompanions,
    pickAnomalyBossEntries,
    resolveAnomalyMap,
    toAnomalyZone,
} from "@/lib/anomaly-boss";
import {
    buildCombatSpellsFromDofusDb,
    normalizeDofensiveGuardian,
    pickAnomalySpellIds,
    syncAnomalyBosses,
} from "@/lib/anomaly-boss-siphon";
import { getAnomalyBossBattleMap } from "@/server/actions/anomaly-boss-actions";

afterEach(() => {
    vi.unstubAllGlobals();
});

function jsonResponse(payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

describe("anomaly-boss — catalogue des gardiens", () => {
    it("utilise la race DofusDB 191 « Gardiens des anomalies » (source de vérité de l'appartenance)", () => {
        expect(ANOMALY_RACE_ID).toBe(191);
    });

    it("nomme une entrée `Dungeon` d'après la CARTE de combat, avec un repli jamais vide", () => {
        expect(buildAnomalyDungeonName("Caverne d'Aguabrial")).toBe("Caverne d'Aguabrial");
        expect(buildAnomalyDungeonName("   ")).toBe("Anomalie temporelle");
        expect(buildAnomalyDungeonName(null)).toBe("Anomalie temporelle");
    });

    it("résout la carte siphonnée (PreferredMaps) sinon la MAP PAR DÉFAUT (Qilby)", () => {
        const siphoned = resolveAnomalyMap([{ id: 196088328, name: "Tour minérale" }]);
        expect(siphoned).toEqual({ id: 196088328, name: "Tour minérale", isDefault: false });

        // Qilby (8131) n'est pas exposé par Dofensive → aucune PreferredMaps → map par défaut.
        const fallback = resolveAnomalyMap([]);
        expect(fallback.id).toBe(DEFAULT_ANOMALY_MAP.id);
        expect(fallback.name).toBe(DEFAULT_ANOMALY_MAP.name);
        expect(fallback.isDefault).toBe(true);
        expect(resolveAnomalyMap(null).isDefault).toBe(true);
    });

    it("regroupe les gardiens par carte (les « monstres de salle » d'une anomalie)", () => {
        const groups = groupAnomalyGuardiansByMap([
            { name: "Agonie la Déterrée", mapId: 196088328 },
            { name: "Cristal Malakite", mapId: 196088328 },
            { name: "Golem Malakite", mapId: 196088328 },
            { name: "Shuccube", mapId: 196088320 },
            { name: "Qilby", mapId: null },
        ]);
        expect(groups[196088328]).toEqual(["Agonie la Déterrée", "Cristal Malakite", "Golem Malakite"]);
        expect(groups[196088320]).toEqual(["Shuccube"]);
        // Map inconnue → rattaché à la map par défaut (jamais perdu).
        expect(groups[DEFAULT_ANOMALY_MAP.id]).toContain("Qilby");
    });

    it("détecte le marqueur `isAnomalyBoss` d'un donjon", () => {
        expect(isAnomalyBossDungeon({ isAnomalyBoss: true })).toBe(true);
        expect(isAnomalyBossDungeon({ isAnomalyBoss: false })).toBe(false);
        expect(isAnomalyBossDungeon(null)).toBe(false);
    });

    it("ne retient que les BOSS comme fiches d'anomalie (les minions restent « monstres de salle »)", () => {
        // Données réelles de la race 191 : les 5 non-boss sont des accompagnateurs
        // (Cristal/Golem Malakite sur la carte d'Agonie, Bourgeon de Dathura, Ondine, Proto-Noxine).
        const guardians = [
            { id: 5684, name: "Agonie la Déterrée", isBoss: true },
            { id: 5685, name: "Cristal Malakite", isBoss: false },
            { id: 5686, name: "Golem Malakite", isBoss: false },
            { id: 8131, name: "Qilby", isBoss: true },
        ];
        expect(pickAnomalyBossEntries(guardians).map((g) => g.name)).toEqual(["Agonie la Déterrée", "Qilby"]);
        expect(pickAnomalyBossEntries([])).toEqual([]);
    });
});

describe("anomaly-boss — formes de zone (calibration DofusDB → Dofensive)", () => {
    it("traduit les gabarits calibrés (P/L/C/X) et laisse « Inconnue » ce qui n'est pas prouvé", () => {
        // 88 = 'X' (Croix) — vérifié sur 12129 (Croix 4) et 12346 (Croix 1).
        expect(toAnomalyZone({ shape: 88, param1: 4 })).toEqual({ shape: "Croix", size: 4, range: 0 });
        expect(toAnomalyZone({ shape: 88, param1: 1 })).toEqual({ shape: "Croix", size: 1, range: 0 });
        // 80 = 'P' (Cellule ciblée) — vérifié sur 12237 et 12060.
        expect(toAnomalyZone({ shape: 80, param1: 1 })?.shape).toBe("Point");
        // 76 = 'L' (Ligne partant du lanceur) — vérifié sur 12038.
        expect(toAnomalyZone({ shape: 76, param1: 4 })?.shape).toBe("Ligne");
        // 67 = 'C' (Cercle) — vérifié sur 12526.
        expect(toAnomalyZone({ shape: 67, param1: 3 })?.shape).toBe("Cercle");
        // Gabarit non identifié : on n'invente rien.
        expect(toAnomalyZone({ shape: 81, param1: 5 })?.shape).toBe("Inconnue");
        expect(toAnomalyZone(null)).toBeNull();
    });
});

describe("anomaly-boss-siphon — reconstruction des sorts (repli DofusDB)", () => {
    it("normalise la réponse Dofensive d'un gardien (PreferredMaps + race + famille)", () => {
        const meta = normalizeDofensiveGuardian({
            PreferredMaps: [{ Id: 196088328, Name: "Tour minérale" }, { Id: 0, Name: "" }],
            Race: { Id: 191, Name: "Gardiens des anomalies" },
            Family: { Id: 35, Name: "Créatures des Anomalies Temporelles" },
            Type: 3,
        });
        expect(meta.preferredMaps).toEqual([{ id: 196088328, name: "Tour minérale" }]);
        expect(meta.raceName).toBe("Gardiens des anomalies");
        expect(meta.familyName).toBe("Créatures des Anomalies Temporelles");
        expect(meta.type).toBe(3);

        const empty = normalizeDofensiveGuardian(undefined);
        expect(empty.preferredMaps).toEqual([]);
        expect(empty.familyName).toBeNull();
    });

    it("collecte les sorts d'un monstre DofusDB (spells + sort de démarrage)", () => {
        expect(
            pickAnomalySpellIds({ spells: [31431, 31426], grades: [{ startingSpellId: 31429 }, { startingSpellId: 31431 }] })
        ).toEqual([31431, 31426, 31429]);
        expect(pickAnomalySpellIds({})).toEqual([]);
    });

    it("rend des sorts EXPLOITABLES par la simulation isométrique (AP, portée, LdV, zone, effets FR)", () => {
        const spells = buildCombatSpellsFromDofusDb(
            [
                {
                    id: 31431,
                    name: "Sablier",
                    imageUrl: "https://api.dofusdb.fr/img/spells/sort_1024.png",
                    description: "Dommages Eau : 61 à 69",
                    apCost: 3,
                    minRange: 1,
                    range: 1,
                    castTestLos: true,
                    castInLine: false,
                    castInDiagonal: false,
                },
            ],
            [
                // Deux niveaux : le plus haut grade doit gagner.
                { spellId: 31431, grade: 1, apCost: 4, minRange: 1, range: 2, maxCastPerTurn: 1 },
                {
                    spellId: 31431,
                    grade: 5,
                    apCost: 3,
                    minRange: 1,
                    range: 6,
                    criticalHitProbability: 30,
                    maxCastPerTurn: 2,
                    maxCastPerTarget: 1,
                    effects: [{ zoneDescr: { shape: 88, param1: 4 } }],
                },
            ]
        );

        expect(spells).toHaveLength(1);
        const spell = spells[0];
        expect(spell.id).toBe(31431);
        expect(spell.name).toBe("Sablier");
        expect(spell.apCost).toBe(3); // grade max prioritaire
        expect(spell.range).toBe(6);
        expect(spell.criticalChance).toBe(30);
        expect(spell.maxCastPerTurn).toBe(2);
        expect(spell.grade).toBe(5);
        expect(spell.zone).toEqual({ shape: "Croix", size: 4, range: 0 });
        // `effects` DOIT être un tableau : la garde de `getLocalDofensiveSpells*` l'exige.
        expect(Array.isArray(spell.effects)).toBe(true);
        expect(spell.effects[0]).toContain("Dommages Eau");
        expect(spell.hasCriticalEffects).toBe(false);
    });

    it("replie sur les champs du sort DofusDB quand DofusDB n'a aucun niveau", () => {
        const spells = buildCombatSpellsFromDofusDb(
            [{ id: 999, name: "Sort inconnu", apCost: 2, minRange: 0, range: 5 }],
            []
        );
        expect(spells[0].apCost).toBe(2);
        expect(spells[0].range).toBe(5);
        expect(spells[0].effects).toEqual([]);
        expect(spells[0].zone).toBeNull();
    });
});

describe("anomaly-boss — monstres de l'anomalie (accompagnateurs Briko / Bruto / Gromo)", () => {
    it("est rattaché à la MÊME famille Dofensive que les gardiens (35 « Créatures des Anomalies Temporelles »)", () => {
        expect(ANOMALY_COMPANION_FAMILY_ID).toBe(35);
        // Sous-races « -morphes » mesurées le 15/09/2026 : Gromorphes 192, Brutomorphes 194, Brikomorphes 195.
        expect([...ANOMALY_COMPANION_RACE_IDS]).toEqual([192, 194, 195]);
        // Règle de jeu : 3 monstres tirés au hasard à l'ouverture de l'anomalie.
        expect(ANOMALY_COMPANION_PICK).toBe(3);
    });

    it("ne retient QUE la famille 35, hors gardiens (race 191) et hors boss", () => {
        expect(isAnomalyCompanion({ familyId: 35, raceId: 195, isBoss: false })).toBe(true);
        // « Intercepteur » (5726) : Gromorphe sans préfixe de nom, même famille → accepté.
        expect(isAnomalyCompanion({ familyId: 35, raceId: 192 })).toBe(true);
        // Un gardien reste un gardien, jamais un accompagnateur.
        expect(isAnomalyCompanion({ familyId: 35, raceId: 191, isBoss: false })).toBe(false);
        expect(isAnomalyCompanion({ familyId: 35, raceId: 195, isBoss: true })).toBe(false);
        // Voisins de la zone d'ids (famille 27 « Créatures de quête ») : jamais inclus.
        expect(isAnomalyCompanion({ familyId: 27, raceId: 196 })).toBe(false);
        expect(isAnomalyCompanion(null)).toBe(false);
    });

    it("ordonne et déduplique par race puis id (Gromorphes → Brutomorphes → Brikomorphes)", () => {
        const ordered = orderAnomalyCompanions([
            { id: 5723, raceId: 195, name: "Briko Exaltant" },
            { id: 5709, raceId: 192, name: "Gromo Envahissant" },
            { id: 5714, raceId: 194, name: "Bruto Acharné" },
            { id: 5709, raceId: 192, name: "Gromo Envahissant" }, // doublon
            { id: 0, raceId: 192, name: "" },
        ]);
        expect(ordered.map((c) => c.name)).toEqual(["Gromo Envahissant", "Bruto Acharné", "Briko Exaltant"]);
    });

    it("compose le pool de simulation « 1 gardien + co-gardiens + accompagnateurs » (dédupliqué, gardien en tête)", () => {
        const pool = buildAnomalyMonsterPool(
            [{ id: 5684, name: "Agonie la Déterrée" }, { id: 5685, name: "Cristal Malakite" }],
            [{ id: 5719, name: "Briko Taquin" }, { id: 5685, name: "Cristal Malakite" }],
            { id: 5684, name: "Agonie la Déterrée" }
        );
        expect(pool.map((m) => m.id)).toEqual([5684, 5685, 5719]);
        expect(buildAnomalyMonsterPool(null, null, null)).toEqual([]);
        expect(buildAnomalyMonsterPool([{ id: 0, name: "" }], [])).toEqual([]);
    });

    it("formule le libellé produit « 3 au hasard parmi N »", () => {
        expect(anomalyCompanionHint(16)).toBe("3 au hasard parmi 16");
        expect(anomalyCompanionHint(0)).toBe("accompagnateurs indisponibles");
        expect(anomalyCompanionHint(null)).toBe("accompagnateurs indisponibles");
    });
});

describe("anomaly-boss — indépendance (fail-closed)", () => {
    it("syncAnomalyBosses ne bloque pas la passe si DofusDB est indisponible", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [], total: 0 })));
        const result = await syncAnomalyBosses();
        expect(result.guardians).toEqual([]);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("getAnomalyBossBattleMap sert la MAP PAR DÉFAUT quand rien n'est siphonné (jamais de map vide)", async () => {
        const res = await getAnomalyBossBattleMap("Qilby", null);
        expect(res.success).toBe(true);
        expect(res.data?.maps).toHaveLength(1);
        expect(res.data?.maps[0].id).toBe(DEFAULT_ANOMALY_MAP.id);
        expect(res.data?.dungeonName).toBe(DEFAULT_ANOMALY_MAP.name);
        // Identifiant synthétique négatif : jamais de collision avec un donjon Dofensive.
        expect(res.data?.dungeonId).toBe(-DEFAULT_ANOMALY_MAP.id);
    });
});

