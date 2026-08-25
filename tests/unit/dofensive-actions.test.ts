import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import {
    getDofensiveMap,
    getDofensiveMonster,
    getDofensiveSpells,
    getDofensiveDungeonForBoss,
} from "@/server/actions/dofensive-actions";

const BASE = "https://dofensive.com/api/dofus2/bestiary";

function jsonResponse(data: unknown): Response {
    return new Response(JSON.stringify({ Data: data, Errors: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("dofensive-actions — garde anti-SSRF", () => {
    it("getDofensiveMap refuse un ID non entier (SSRF) SANS appeler fetch", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const res = await getDofensiveMap("123@evil.com/..%2f..%2fetc%2fpasswd");
        expect(res.success).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("getDofensiveMap refuse les IDs invalides (chaîne, zéro, négatif) sans fetch", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        expect((await getDofensiveMap("abc")).success).toBe(false);
        expect((await getDofensiveMap("0")).success).toBe(false);
        expect((await getDofensiveMap("-12")).success).toBe(false);
        expect((await getDofensiveMap(0)).success).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("getDofensiveMap construit l'URL exacte de l'allowlist pour un ID valide", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse([{ Id: 236716546, Name: "Map", Cells: [], AllyCells: [], EnemyCells: [] }])
        );
        vi.stubGlobal("fetch", fetchMock);
        const res = await getDofensiveMap("236716546");
        expect(res.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE}/maps/236716546?lang=fr`);
    });

    it("getDofensiveMonster refuse un ID invalide sans fetch", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        expect((await getDofensiveMonster(-5)).success).toBe(false);
        expect((await getDofensiveMonster(Number.NaN)).success).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("dofensive-actions — résolution donjon multi-boss (durable)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("résout par token-overlap un donjon dont le nom DofusDB diffère de Dofensive (Temple ↔ Tempête)", async () => {
        const fetchMock = vi.fn((url: unknown) => {
            const u = String(url);
            if (u.includes("/dungeons/preview")) {
                return Promise.resolve(
                    jsonResponse([
                        {
                            Id: 121,
                            Name: "Tempête de l'Eliocalypse",
                            Level: 200,
                            Maps: [{ Id: 204476422, Name: "Tempête de l'Eliocalypse - Déluge" }],
                            Monsters: [
                                { Id: 6026, Name: "Corruption" },
                                { Id: 6014, Name: "Guerre" },
                                { Id: 5990, Name: "Misère" },
                                { Id: 5955, Name: "Servitude" },
                            ],
                        },
                    ])
                );
            }
            if (u.includes("/monsters/6026")) {
                return Promise.resolve(
                    jsonResponse([
                        { Id: 6026, Name: "Corruption", PreferredMaps: [{ Id: 204476422, Name: "Tempête de l'Eliocalypse - Déluge" }] },
                    ])
                );
            }
            return Promise.resolve(jsonResponse(null));
        });
        vi.stubGlobal("fetch", fetchMock);

        // bossName DofusDB (« Sanctuaire du dernier espoir ») ≠ nom Dofensive, mais le
        // nom de donjon partage le token « Eliocalypse » → le donjon Dofensive est résolu.
        const res = await getDofensiveDungeonForBoss("Sanctuaire du dernier espoir", "Temple de l'Eliocalypse");

        expect(res.success).toBe(true);
        expect(res.data?.dungeonName).toBe("Tempête de l'Eliocalypse");
        expect(res.data?.maps).toEqual([{ id: 204476422, name: "Tempête de l'Eliocalypse - Déluge", isBoss: true }]);
        // Boss résolu = 1re entité du donjon (Corruption) car le bossName DofusDB ne matche aucun monstre.
        expect(res.data?.bossMonsterId).toBe(6026);
        expect(res.data?.monsters).toHaveLength(4);
    });
});
describe("dofensive-actions — sorts Dofensive (données de combat)", () => {


    it("getDofensiveSpells normalise AP/portée/LoS/cooldown/zone depuis /spells/{id}", async () => {
        const fetchMock = vi.fn((url: unknown) => {
            const u = String(url);
            if (u.includes("/monsters/5055")) {
                return Promise.resolve(jsonResponse([{ Id: 5055, Spells: [{ Id: 10591, Name: "Sort Test" }] }]));
            }
            if (u.includes("/spells/10591")) {
                return Promise.resolve(
                    jsonResponse([
                        {
                            Id: 10591,
                            Name: "Sort Test",
                            Levels: [
                                {
                                    Grade: 1,
                                    ActionPoints: 4,
                                    MinRange: 1,
                                    Range: 6,
                                    CastLineOfSight: true,
                                    CastInLine: true,
                                    CastInDiagonal: false,
                                    MaxCastPerTurn: 2,
                                    MinCastInterval: 1,
                                    GroupEffects: [
                                        { Effects: [{ Zone: { Name: "Cercle de proximité de taille #1", Size: 2, Range: 0 } }] },
                                    ],
                                },
                            ],
                        },
                    ])
                );
            }
            return Promise.resolve(jsonResponse(null));
        });
        vi.stubGlobal("fetch", fetchMock);
        const res = await getDofensiveSpells(5055);
        expect(res.success).toBe(true);
        const spell = res.data?.[0];
        expect(spell).toMatchObject({
            id: 10591,
            name: "Sort Test",
            imageUrl: "https://cdn.static.dofensive.com/dofensive/spells/10591",
            apCost: 4,
            minRange: 1,
            range: 6,
            castTestLos: true,
            castInLine: true,
            castInDiagonal: false,
            maxCastPerTurn: 2,
            minCastInterval: 1,
        });
        expect(spell?.zone).toEqual({ shape: "Cercle", size: 2, range: 0 });
    });

    it("getDofensiveSpells inclut le StartingSpell du Grade (ex. Instinct maternel) et garde maxCastPerTurn 0", async () => {
        const fetchMock = vi.fn((url: unknown) => {
            const u = String(url);
            if (u.includes("/monsters/3234")) {
                return Promise.resolve(
                    jsonResponse([
                        {
                            Id: 3234,
                            Spells: [{ Id: 2673, Name: "Lait Maternel" }],
                            Grades: [{ StartingSpell: { Id: 2676, Name: "Instinct maternel" } }],
                        },
                    ])
                );
            }
            if (u.includes("/spells/2676")) {
                return Promise.resolve(
                    jsonResponse([
                        {
                            Id: 2676,
                            Name: "Instinct maternel",
                            Levels: [
                                {
                                    Grade: 1,
                                    ActionPoints: 0,
                                    MinRange: 0,
                                    Range: 0,
                                    CastLineOfSight: false,
                                    CriticalProbability: 15,
                                    MaxCastPerTurn: 0,
                                    MaxCastPerTarget: 1,
                                    MinCastInterval: 1,
                                    GroupEffects: [
                                        {
                                            Effects: [
                                                {
                                                    Name: "#1 dommages Eau",
                                                    Parameters: [{ Name: "101" }],
                                                    Zone: { Name: "Cellule ciblée", Size: -1, Range: 0 },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ])
                );
            }
            return Promise.resolve(jsonResponse(null));
        });
        vi.stubGlobal("fetch", fetchMock);
        const res = await getDofensiveSpells(3234);
        expect(res.success).toBe(true);
        expect(res.data?.map((s) => s.id)).toEqual([2676]); // StartingSpell d'abord, Spells ensuite
        const starting = res.data?.[0];
        expect(starting?.name).toBe("Instinct maternel");
        expect(starting?.maxCastPerTurn).toBe(0); // ne doit PAS devenir 1
        expect(starting?.maxCastPerTarget).toBe(1);
        expect(starting?.criticalChance).toBe(15);
        expect(starting?.effects).toEqual(["101 dommages Eau"]);
        expect(starting?.imageUrl).toBe("https://cdn.static.dofensive.com/dofensive/spells/2676");
        expect(starting?.zone).toEqual({ shape: "Point", size: 0, range: 0 }); // Cellule ciblée → Point
        // Nouveaux champs enrichis : grade + version structurée des effets.
        expect(starting?.grade).toBe(1);
        expect(starting?.effectDetails).toEqual([
            { label: "101 dommages Eau", duration: null, triggers: [], masks: [] },
        ]);
        expect(starting?.hasCriticalEffects).toBe(false);
        expect(starting?.criticalEffects).toBeUndefined();
    });

    it("getDofensiveSpells : description, durées (infini / N tours), déclencheurs, masques, pluriels", async () => {
        const fetchMock = vi.fn((url: unknown) => {
            const u = String(url);
            if (u.includes("/monsters/2986")) {
                return Promise.resolve(
                    jsonResponse([
                        {
                            Id: 2986,
                            Spells: [{ Id: 2479, Name: "Baïkal" }],
                            Grades: [{ StartingSpell: { Id: 32666, Name: "Piautre" } }],
                        },
                    ])
                );
            }
            if (u.includes("/spells/32666")) {
                return Promise.resolve(
                    jsonResponse([
                        {
                            Id: 32666,
                            Name: "Piautre",
                            Description: "Ce sort est lancé une seule fois par l'ennemi lorsqu'il rejoint le combat.",
                            Levels: [
                                {
                                    Grade: 1,
                                    ActionPoints: 5,
                                    MinRange: 0,
                                    Range: 0,
                                    CastLineOfSight: false,
                                    GroupEffects: [
                                        {
                                            Effects: [
                                                {
                                                    Name: "État Invulnérable",
                                                    Parameters: [],
                                                    Duration: -1,
                                                    TargetTriggers: [
                                                        { Name: "{La cible |0}reçoit des dommages d'une invocation", Parameters: [] },
                                                    ],
                                                    InclusionMasks: [{ Name: "{Affecte |0}le lanceur (même en-dehors de la zone d'effet)", Parameters: [] }],
                                                },
                                                {
                                                    Name: "#1 Fuite",
                                                    Parameters: [{ Name: "-10" }],
                                                    Duration: 1,
                                                    TargetTriggers: [
                                                        { Name: "{La cible |0}reçoit des dommages d'une invocation", Parameters: [] },
                                                    ],
                                                },
                                                {
                                                    Name: "Attire de #1 case{s|#1}",
                                                    Parameters: [{ Name: "2" }],
                                                    Duration: 0,
                                                },
                                            ],
                                        },
                                    ],
                                    GroupCriticalEffects: [],
                                },
                            ],
                        },
                    ])
                );
            }
            return Promise.resolve(jsonResponse(null));
        });
        vi.stubGlobal("fetch", fetchMock);

        const res = await getDofensiveSpells(2986);
        expect(res.success).toBe(true);
        const spell = res.data?.[0];
        expect(spell?.name).toBe("Piautre");
        expect(spell?.grade).toBe(1); // « Piautre (Niv. 1) »
        expect(spell?.description).toBe("Ce sort est lancé une seule fois par l'ennemi lorsqu'il rejoint le combat.");
        // Lignes plates : label + (durée) + déclencheurs.
        expect(spell?.effects).toEqual([
            "État Invulnérable (infini)",
            "L'effet est déclenché lorsque la cible reçoit des dommages d'une invocation",
            "-10 Fuite (pour 1 tour)",
            "L'effet est déclenché lorsque la cible reçoit des dommages d'une invocation",
            "Attire de 2 cases",
        ]);
        // Version structurée : durées, déclencheurs, masques.
        expect(spell?.effectDetails?.[0]).toEqual({
            label: "État Invulnérable",
            duration: "infini",
            triggers: ["L'effet est déclenché lorsque la cible reçoit des dommages d'une invocation"],
            masks: ["Affecte le lanceur (même en-dehors de la zone d'effet)"],
        });
        expect(spell?.effectDetails?.[1]).toEqual({
            label: "-10 Fuite",
            duration: "pour 1 tour",
            triggers: ["L'effet est déclenché lorsque la cible reçoit des dommages d'une invocation"],
            masks: [],
        });
        // Aucun effet critique → « Aucun effet critique » côté UI.
        expect(spell?.hasCriticalEffects).toBe(false);
        expect(spell?.criticalEffects).toBeUndefined();
    });
    it("getDofensiveSpells : les GroupCriticalEffects remplissent la section critiques", async () => {
        const fetchMock = vi.fn((url: unknown) => {
            const u = String(url);
            if (u.includes("/monsters/777")) {
                return Promise.resolve(
                    jsonResponse([
                        {
                            Id: 777,
                            Grades: [{ StartingSpell: { Id: 2480, Name: "Illyana" } }],
                        },
                    ])
                );
            }
            if (u.includes("/spells/2480")) {
                return Promise.resolve(
                    jsonResponse([
                        {
                            Id: 2480,
                            Name: "Illyana",
                            Levels: [
                                {
                                    Grade: 2,
                                    CriticalProbability: 20,
                                    GroupEffects: [
                                        { Effects: [{ Name: "#1 soins Feu", Parameters: [{ Name: "86" }], Duration: 0 }] },
                                    ],
                                    GroupCriticalEffects: [
                                        { Effects: [{ Name: "#1 soins Feu", Parameters: [{ Name: "95" }], Duration: 0 }] },
                                    ],
                                },
                            ],
                        },
                    ])
                );
            }
            return Promise.resolve(jsonResponse(null));
        });
        vi.stubGlobal("fetch", fetchMock);

        const res = await getDofensiveSpells(777);
        expect(res.success).toBe(true);
        const spell = res.data?.[0];
        expect(spell?.grade).toBe(2);
        expect(spell?.effects).toEqual(["86 soins Feu"]);
        expect(spell?.hasCriticalEffects).toBe(true);
        expect(spell?.criticalEffects).toEqual(["95 soins Feu"]);
    });

    it("mergeDofensiveSpells : le combat Dofensive prime, icône CDN Dofensive préférée", () => {

        const dbSpells = [
            { id: 10591, name: "Sort Test", imageUrl: "https://img/spell.png", description: "descr", apCost: 3, range: 4 },
            { id: 99999, name: "Sort Invocation", imageUrl: "https://img/invoc.png" },
        ];
        const dofensive = [
            {
                id: 10591,
                name: "Sort Test",
                imageUrl: "https://cdn.static.dofensive.com/dofensive/spells/10591",
                apCost: 4,
                minRange: 1,
                range: 6,
                castTestLos: true,
                castInLine: true,
                castInDiagonal: false,
                maxCastPerTurn: 2,
                minCastInterval: 1,
                zone: { shape: "Cercle" as const, size: 2, range: 0 },
            },
        ];
        const merged = mergeDofensiveSpells(dbSpells as any, dofensive as any);
        expect(merged).toHaveLength(2);
        const m = merged.find((s) => s.id === 10591);
        expect(m?.apCost).toBe(4); // Dofensive prime
        expect(m?.imageUrl).toBe("https://cdn.static.dofensive.com/dofensive/spells/10591"); // icône CDN préférée
        expect(m?.description).toBe("descr"); // description DofusDB conservée
        expect(m?.zone).toEqual({ shape: "Cercle", size: 2, range: 0 });
        // Le sort d'invocation (uniquement DofusDB) est conservé.
        expect(merged.some((s) => s.id === 99999)).toBe(true);
    });
});
