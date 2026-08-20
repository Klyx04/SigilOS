import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import {
    getDofensiveMap,
    getDofensiveMonster,
    getDofensiveSpells,
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
                                    MaxCastPerTurn: 0,
                                    MinCastInterval: 1,
                                    GroupEffects: [{ Effects: [{ Zone: { Name: "Cellule ciblée", Size: -1, Range: 0 } }] }],
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
        expect(starting?.imageUrl).toBe("https://cdn.static.dofensive.com/dofensive/spells/2676");
        expect(starting?.zone).toEqual({ shape: "Point", size: 0, range: 0 }); // Cellule ciblée → Point
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
