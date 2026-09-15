/**
 * Lot 1 « stale-while-offline » + D6 « interrupteur de test de panne » (amorce
 * `src/temp/amorces/amorce-2026-09-15-independance-totale.md`).
 *
 * Ce que ces tests PROUVENT :
 *   1. une ligne locale **périmée** (> TTL) est **servie** (marquée `stale`, datée) au lieu
 *      d'être transformée en absence ⇒ plus de bascule live silencieuse ;
 *   2. le repli live n'est tenté que quand **aucune** ligne n'existe ;
 *   3. `DOFUSDB_OFFLINE=1` / `DOFENSIVE_OFFLINE=1` coupent **tout** appel sortant (0 fetch).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ── Socle : PostgreSQL mocké (aucune base en test) ────────────────────────────
const monsterStatFindFirst = vi.fn();
const monsterStatFindUnique = vi.fn();
const dofensiveMapFindUnique = vi.fn();
const dofensiveDungeonFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        monsterStat: {
            findFirst: (...args: any[]) => monsterStatFindFirst(...args),
            findUnique: (...args: any[]) => monsterStatFindUnique(...args),
        },
        dofensiveMap: {
            findUnique: (...args: any[]) => dofensiveMapFindUnique(...args),
            upsert: vi.fn(),
        },
        dofensiveDungeon: {
            findMany: (...args: any[]) => dofensiveDungeonFindMany(...args),
        },
    },
}));

type SyncMod = typeof import("@/lib/dofensive-sync");
type ActionsMod = typeof import("@/server/actions/dofensive-actions");
let sync: SyncMod;
let actions: ActionsMod;

const DAY = 24 * 60 * 60 * 1000;
/** 40 j > `SYNC_TTL` (24 h) : ligne existante mais PÉRIMÉE. */
const STALE = new Date(Date.now() - 40 * DAY);
const FRESH = new Date();

function jsonResponse(payload: unknown): Response {
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** Un fetch qui ÉCHOUE s'il est appelé : c'est l'assertion du test de panne. */
function forbiddenFetch() {
    return vi.fn(() => {
        throw new Error("appel réseau interdit (test de panne)");
    });
}

beforeAll(async () => {
    // Les getters locaux refusent PostgreSQL quand `VITEST=true` (garde anti-DB des tests) :
    // on lève ce garde-fou EXPLICITEMENT et UNIQUEMENT dans ce fichier pour tester le Lot 1.
    vi.stubEnv("VITEST", "false");
    vi.resetModules();
    sync = await import("@/lib/dofensive-sync");
    actions = await import("@/server/actions/dofensive-actions");
});

afterAll(() => {
    vi.unstubAllEnvs();
});

afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe("Lot 1 — stale-while-offline (une péremption n'est jamais une absence)", () => {
    it("sert une fiche monstre PÉRIMÉE (stale + date) là où le getter gaté refusait", async () => {
        monsterStatFindFirst.mockResolvedValue({ stats: { id: 999, name: "Vieux" }, lastSyncedAt: STALE });

        const hit = await sync.getLocalMonsterStatAny("Vieux");
        expect(hit?.data).toEqual({ id: 999, name: "Vieux" });
        expect(hit?.stale).toBe(true);
        expect(hit?.lastSyncedAt?.toISOString()).toBe(STALE.toISOString());

        // Non-régression : le getter GATÉ (fraîcheur 24 h) garde son comportement historique.
        await expect(sync.getLocalMonsterStat("Vieux")).resolves.toBeNull();
    });

    it("sert une fiche FRAÎCHE sans la marquer périmée (non-régression)", async () => {
        monsterStatFindFirst.mockResolvedValue({ stats: { id: 1, name: "Frais" }, lastSyncedAt: FRESH });

        const hit = await sync.getLocalMonsterStatAny("Frais");
        expect(hit?.stale).toBe(false);
        await expect(sync.getLocalMonsterStat("Frais")).resolves.toEqual({ id: 1, name: "Frais" });
    });

    it("renvoie null (⇒ repli live légitime) quand AUCUNE ligne n'existe", async () => {
        monsterStatFindFirst.mockResolvedValue(null);
        await expect(sync.getLocalMonsterStatAny("Inconnu")).resolves.toBeNull();
        await expect(sync.getLocalMonsterStat("Inconnu")).resolves.toBeNull();
    });

    it("sorts : sert une ligne périmée, mais refuse toujours un payload sans sorts de combat", async () => {
        monsterStatFindUnique.mockResolvedValue({
            stats: { spells: [{ id: 1, name: "Sablier", apCost: 3, effects: ["Dommages Eau"] }] },
            lastSyncedAt: STALE,
        });
        const hit = await sync.getLocalDofensiveSpellsAny(123);
        expect(hit?.stale).toBe(true);
        expect(hit?.data).toHaveLength(1);
        await expect(sync.getLocalDofensiveSpells(123)).resolves.toBeNull();

        // Payload DofusDB brut (pas d'`apCost`) : inexploitable pour la simulation → null,
        // même frais (le repli live pourra enrichir).
        monsterStatFindUnique.mockResolvedValue({
            stats: { spells: [{ id: 9, name: "brut" }] },
            lastSyncedAt: FRESH,
        });
        await expect(sync.getLocalDofensiveSpellsAny(123)).resolves.toBeNull();
    });
    it("sert une map PÉRIMÉE sans aucun appel réseau (`/maps/{id}` jamais appelé)", async () => {
        const fetchSpy = forbiddenFetch();
        vi.stubGlobal("fetch", fetchSpy);
        dofensiveMapFindUnique.mockResolvedValue({
            mapId: 700,
            name: "Balcon de Sylargh",
            dungeonId: 71,
            subarea: null,
            coords: { x: 1, y: 2 },
            cells: [[0]],
            allyCells: [1],
            enemyCells: [2],
            isBossMap: true,
            lastSyncedAt: STALE,
        });

        const res = await actions.getDofensiveMap(700);
        expect(res.success).toBe(true);
        expect(res.stale).toBe(true);
        expect(res.syncedAt).toBe(STALE.toISOString());
        expect(res.data?.name).toBe("Balcon de Sylargh");
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sert un donjon PÉRIMÉ (donc la fiche boss et la simulation) sans appel réseau", async () => {
        const fetchSpy = forbiddenFetch();
        vi.stubGlobal("fetch", fetchSpy);
        dofensiveDungeonFindMany.mockResolvedValue([
            {
                dungeonId: 71,
                name: "Donjon Test",
                monsters: [{ id: 10, name: "Bouftou" }],
                maps: [{ id: 700, name: "Salle 1", isBoss: true }],
                bossMonsterId: 10,
                lastSyncedAt: STALE,
            },
        ]);

        const res = await actions.getDofensiveDungeonForBoss("Bouftou", "Donjon Test");
        expect(res.success).toBe(true);
        expect(res.stale).toBe(true);
        expect(res.syncedAt).toBe(STALE.toISOString());
        expect(res.data?.dungeonId).toBe(71);
        expect(res.data?.monsters).toHaveLength(1);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sert les sorts de combat PÉRIMÉS d'un monstre sans appel réseau", async () => {
        const fetchSpy = forbiddenFetch();
        vi.stubGlobal("fetch", fetchSpy);
        monsterStatFindUnique.mockResolvedValue({
            stats: { spells: [{ id: 1, name: "Sablier", apCost: 3, effects: ["Dommages Eau"] }] },
            lastSyncedAt: STALE,
        });

        const res = await actions.getDofensiveSpells(123);
        expect(res.success).toBe(true);
        expect(res.stale).toBe(true);
        expect(res.data).toHaveLength(1);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sans AUCUNE ligne locale, le repli live reste possible (contrôle)", async () => {
        dofensiveMapFindUnique.mockResolvedValue(null);
        const fetchSpy = vi.fn(() =>
            Promise.resolve(jsonResponse({ Data: [{ Id: 700, Name: "Live", Cells: [[0]], AllyCells: [], EnemyCells: [] }], Errors: [] }))
        );
        vi.stubGlobal("fetch", fetchSpy);

        const res = await actions.getDofensiveMap(700);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(res.success).toBe(true);
        expect(res.data?.name).toBe("Live");
    });

    it("`toStaleResult` / `pickCombatSpells` : règles pures", () => {
        expect(sync.SYNC_TTL).toBe(24 * 60 * 60 * 1000);
        expect(sync.toStaleResult({ a: 1 }, FRESH).stale).toBe(false);
        expect(sync.toStaleResult({ a: 1 }, STALE).stale).toBe(true);
        // Date absente ⇒ périmé + date null (jamais une date inventée).
        const noDate = sync.toStaleResult({ a: 1 }, null);
        expect(noDate.stale).toBe(true);
        expect(noDate.lastSyncedAt).toBeNull();

        expect(sync.pickCombatSpells([])).toBeNull();
        expect(sync.pickCombatSpells([{ name: "brut" }])).toBeNull();
        expect(sync.pickCombatSpells([{ apCost: 1, effects: [] }])).toHaveLength(1);
    });
});

describe("D6 — interrupteur de test de panne (aucun appel sortant)", () => {
    it("DOFUSDB_OFFLINE=1 ⇒ DofusDB coupé (fetch jamais appelé, null renvoyé)", async () => {
        vi.stubEnv("DOFUSDB_OFFLINE", "1");
        const fetchSpy = forbiddenFetch();
        vi.stubGlobal("fetch", fetchSpy);

        const { dofusdbFetch, isDofusDbOffline } = await import("@/lib/dofusdb-fetch");
        expect(isDofusDbOffline()).toBe(true);
        await expect(dofusdbFetch("/monsters?race=191&lang=fr")).resolves.toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sans l'interrupteur, DofusDB est bien interrogé (contrôle)", async () => {
        vi.stubEnv("DOFUSDB_OFFLINE", "0");
        const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({ data: [{ id: 8131 }] })));
        vi.stubGlobal("fetch", fetchSpy);

        const { dofusdbFetch, isDofusDbOffline } = await import("@/lib/dofusdb-fetch");
        expect(isDofusDbOffline()).toBe(false);
        await expect(dofusdbFetch("/monsters?race=191&lang=fr")).resolves.toEqual([{ id: 8131 }]);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("DOFENSIVE_OFFLINE=1 ⇒ bestiaire, maps, sorts et donjons coupés", async () => {
        vi.stubEnv("DOFENSIVE_OFFLINE", "1");
        const fetchSpy = forbiddenFetch();
        vi.stubGlobal("fetch", fetchSpy);

        const { dofensiveFetch, isDofensiveOffline } = await import("@/lib/dofensive-fetch");
        expect(isDofensiveOffline()).toBe(true);
        await expect(dofensiveFetch("/dungeons/preview?lang=fr", "k-dungeons", true)).resolves.toBeNull();
        await expect(dofensiveFetch("/maps/700?lang=fr", "k-map", true)).resolves.toBeNull();
        await expect(dofensiveFetch("/monsters/10?lang=fr", "k-monster", true)).resolves.toBeNull();
        await expect(dofensiveFetch("/spells/1?lang=fr", "k-spell", true)).resolves.toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sans l'interrupteur, Dofensive est bien interrogé (contrôle)", async () => {
        vi.stubEnv("DOFENSIVE_OFFLINE", "0");
        const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({ Data: [{ Id: 700, Name: "Live" }], Errors: [] })));
        vi.stubGlobal("fetch", fetchSpy);

        const { dofensiveFetch, isDofensiveOffline } = await import("@/lib/dofensive-fetch");
        expect(isDofensiveOffline()).toBe(false);
        await expect(dofensiveFetch("/maps/700?lang=fr", "k-map-control", true)).resolves.toEqual([{ Id: 700, Name: "Live" }]);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});
