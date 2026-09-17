/**
 * Chantier « Avis de recherche » (Lot 1) — siphon DofusDB + Dofensive.
 *
 * Vérifie les règles MESURÉES le 16/09/2026 :
 *   - la liste vient des 5 RACES `monster-races` (le drapeau `isBounty` est faux pour 14/96) ;
 *   - la preuve d'appartenance vient de Dofensive (`Race.Name` / `Family.Id` 27) ;
 *   - l'upsert `Bounty` se fait par `dofusdbId` (3 homonymes « Ronce » ⇒ jamais par nom) ;
 *   - la carte de simulation est la **grille vide** (Dofensive n'expose aucune grille d'avis) ;
 *   - un avis **supprimé dans God** (liste d'exclusion) n'est jamais recréé ;
 *   - panne DofusDB ⇒ aucune écriture ; panne Dofensive ⇒ liste conservée (`validated:false`).
 *
 * Aucun réseau, aucune base : `dofusdbFetch` / `dofensiveFetch` / `db` sont mockés.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    BOUNTY_MAP_EMPTY_LABEL,
    BOUNTY_RACE_IDS,
    bountyCriteriaLabels,
    bountyDofensiveSpellIds,
    bountyDofensiveUrl,
    bountyDofusDbUrl,
    bountyDropObjectIds,
    bountyLevel,
    bountyLevelRange,
    bountyRaceName,
    bountySlug,
    isBountyRace,
    isBountyRaceName,
    isProvenBounty,
    pickBountyBattleMap,
    pickBountySubarea,
} from "@/lib/bounty";

// ─── Mocks de la chaîne serveur ────────────────────────────────────────────────
const mockDofusDbFetch = vi.fn();
vi.mock("@/lib/dofusdb-fetch", () => ({
    dofusdbFetch: (...args: any[]) => mockDofusDbFetch(...args),
}));

const mockDofensiveFetch = vi.fn();
vi.mock("@/lib/dofensive-fetch", () => ({
    dofensiveFetch: (...args: any[]) => mockDofensiveFetch(...args),
}));

const mockFindUniqueBounty = vi.fn();
const mockCreateBounty = vi.fn();
const mockUpdateBounty = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        bounty: {
            findUnique: (...args: any[]) => mockFindUniqueBounty(...args),
            create: (...args: any[]) => mockCreateBounty(...args),
            update: (...args: any[]) => mockUpdateBounty(...args),
        },
    },
}));

const mockPersist = vi.fn();
const mockSiphonMap = vi.fn();
vi.mock("@/lib/dofensive-sync", () => ({
    DB_READABLE: true,
    persistMonsterStat: (...args: any[]) => mockPersist(...args),
    siphonDofensiveMapById: (...args: any[]) => mockSiphonMap(...args),
    mapWithConcurrency: async <T, R>(items: T[], _limit: number, fn: (item: T) => Promise<R>) => {
        const out: R[] = [];
        for (const item of items) out.push(await fn(item));
        return out;
    },
}));

const mockSiphonImage = vi.fn();
vi.mock("@/lib/dofus-asset-siphon", () => ({
    siphonAndCompressImage: (...args: any[]) => mockSiphonImage(...args),
}));

const mockGetMonsterStats = vi.fn();
vi.mock("@/server/actions/game-data-actions", () => ({
    getMonsterStats: (...args: any[]) => mockGetMonsterStats(...args),
}));

const mockGetDofensiveSpells = vi.fn();
vi.mock("@/server/actions/dofensive-actions", () => ({
    getDofensiveSpells: (...args: any[]) => mockGetDofensiveSpells(...args),
}));

/* Liste d'exclusion « avis supprimés dans God » (module fs) : pilotée par le test. */
const mockIgnoredBountyIds = vi.fn();
vi.mock("@/lib/bounty-ignore", () => ({
    getIgnoredBountyIds: (...args: any[]) => mockIgnoredBountyIds(...args),
    isIgnoredBounty: (id: number, ignored?: number[]) => (ignored ?? mockIgnoredBountyIds()).includes(id),
}));

const { syncBounties } = await import("@/lib/bounty-siphon");
// ─── Fixtures ──────────────────────────────────────────────────────────────────
const PREDAGOB = {
    id: 4834,
    name: { fr: "Predagob" },
    gfxId: 1583,
    img: "https://api.dofusdb.fr/img/monsters/1583.png",
    grades: [{ level: 190 }, { level: 190 }, { level: 190 }, { level: 190 }, { level: 190 }],
    drops: [{ objectId: 18803 }, { objectId: 26870 }, { objectId: 18803 }],
    subareas: [883],
    spells: [8589, 8590, 8591],
};

/** Métadonnée Dofensive d'un avis réel (extrait mesuré le 16/09/2026). */
const PREDAGOB_META = {
    Id: 4834,
    Name: "Predagob",
    Race: { Id: 32, Name: "Avis de recherche" },
    Family: { Id: 27, Name: "Créatures de quête" },
    Spells: [{ Id: 8589 }, { Id: 8590 }, { Id: 8591 }],
    Grades: [{ Id: 1, StartingSpell: { Id: 8586, Name: "Camouflage Gobptique" } }],
    Subareas: [{ Id: 883, Name: "Nimotopia", IsFavorite: true }],
    Drops: [
        {
            Id: 18803,
            Criteria: [
                [
                    { Type: 7, Name: "Ne pas être dans la sous-zone #1" },
                    { Type: 30, Name: "Avoir l'étape #1 de la quête #2 en cours" },
                ],
                [{ Type: 30, Name: "Avoir l'étape #1 de la quête #2 en cours" }],
            ],
        },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
    mockIgnoredBountyIds.mockReturnValue([]);
    mockDofusDbFetch.mockResolvedValue([]);
    mockDofensiveFetch.mockResolvedValue(null);
    mockFindUniqueBounty.mockResolvedValue(null);
    mockCreateBounty.mockResolvedValue({ id: "b1" });
    mockUpdateBounty.mockResolvedValue({ id: "b1" });
    mockSiphonMap.mockResolvedValue(true);
    mockSiphonImage.mockResolvedValue({ success: true, localUrl: "/api/assets-dofus/monsters/4834" });
    mockGetMonsterStats.mockResolvedValue({ success: true, data: { id: 4834, name: "Predagob", spells: [{ id: 8589, imageUrl: "https://api.dofusdb.fr/img/spells/sort_1.png" }] } });
    mockGetDofensiveSpells.mockResolvedValue({ success: true, data: [{ id: 8589, name: "Moâ chasser bestioles !", apCost: 4, effects: [] }] });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Helpers purs ──────────────────────────────────────────────────────────────
describe("bounty.ts — helpers purs (aucun réseau)", () => {
    it("périmètre = les 5 races DofusDB « Avis de recherche »", () => {
        expect([...BOUNTY_RACE_IDS]).toEqual([32, 90, 127, 147, 156]);
        expect(isBountyRace(32)).toBe(true);
        expect(isBountyRace("147")).toBe(true);
        expect(isBountyRace(191)).toBe(false);   // gardiens d'anomalie
        expect(isBountyRace(null)).toBe(false);
        expect(isBountyRaceName("Avis de recherche des Dimensions")).toBe(true);
        expect(isBountyRaceName("Gardiens des anomalies")).toBe(false);
    });

    it("zone de traque : favorite d'abord, sinon la première, jamais inventée", () => {
        expect(pickBountySubarea([
            { Id: 1, Name: "A" },
            { Id: 883, Name: "Nimotopia", IsFavorite: true },
        ])).toEqual({ id: 883, name: "Nimotopia", isFavorite: true });

        expect(pickBountySubarea([883])).toEqual({ id: 883, name: "", isFavorite: false });
        expect(pickBountySubarea([])).toBeNull();
        expect(pickBountySubarea(null)).toBeNull();
        expect(pickBountySubarea([{ Id: 0, Name: "invalide" }])).toBeNull();
    });

    it("slug : unique même pour les homonymes « Ronce »", () => {
        expect(bountySlug("Ronce", 3530)).toBe("ronce-3530");
        expect(bountySlug("Ronce", 3555)).toBe("ronce-3555");
        expect(bountySlug("Aermyne 'Braco' Scalptaras", 446)).toBe("aermyne-braco-scalptaras-446");
        expect(bountySlug("", null)).toBe("avis");
    });

    it("niveaux : 5 ou 7 grades (plage + niveau affiché = plus haut grade)", () => {
        expect(bountyLevelRange([{ level: 140 }, { level: 141 }])).toEqual({ min: 140, max: 141 });
        expect(bountyLevel([{ level: 190 }])).toBe(190);
        expect(bountyLevel([])).toBe(1);
        expect(bountyLevelRange([])).toEqual({ min: null, max: null });
    });

    it("carte de simulation : GRILLE VIDE par défaut (aucune carte d'emprunt pour un avis)", () => {
        expect(pickBountyBattleMap(null)).toEqual({ id: 0, source: "none" });
        expect(pickBountyBattleMap(0)).toEqual({ id: 0, source: "none" });
        expect(pickBountyBattleMap(95870721)).toEqual({ id: 95870721, source: "dofensive" });
        expect(BOUNTY_MAP_EMPTY_LABEL).toBe("Map vide");
    });

    it("sorts Dofensive : Spells[] + sort d'ouverture du grade 1 (Predagob = 8586/8589/8590/8591)", () => {
        expect(bountyDofensiveSpellIds(PREDAGOB_META)).toEqual([8589, 8590, 8591, 8586]);
        expect(bountyDofensiveSpellIds(null)).toEqual([]);
    });

    it("butin : objectIds dédupliqués + critères de quête (texte réel de la source)", () => {
        expect(bountyDropObjectIds(PREDAGOB)).toEqual([18803, 26870]);
        expect(bountyCriteriaLabels(PREDAGOB_META)).toEqual([
            "Ne pas être dans la sous-zone #1",
            "Avoir l'étape #1 de la quête #2 en cours",
        ]);
        expect(bountyCriteriaLabels(null)).toEqual([]);
    });

    it("preuve d'appartenance : Race « Avis de recherche » OU famille 27", () => {
        expect(isProvenBounty(PREDAGOB_META)).toBe(true);
        expect(isProvenBounty({ Race: { Name: "Avis de recherche de Frigost" }, Family: { Id: 27 } })).toBe(true);
        expect(isProvenBounty({ Family: { Id: 27 } })).toBe(true);
        expect(isProvenBounty({ Race: { Name: "Gardiens des anomalies" }, Family: { Id: 35 } })).toBe(false);
        expect(isProvenBounty(null)).toBe(false);
    });

    it("libellés de race + URLs de source, null si l'id est invalide", () => {
        expect(bountyRaceName(32)).toBe("Avis de recherche");
        expect(bountyRaceName(9999, "Avis de recherche des Dimensions")).toBe("Avis de recherche des Dimensions");
        expect(bountyRaceName(0)).toBe("Avis de recherche");
        expect(bountyDofusDbUrl(4834)).toBe("https://dofusdb.fr/fr/database/monster/4834");
        expect(bountyDofensiveUrl(4834)).toBe("https://dofensive.com/fr/monster/4834");
        expect(bountyDofusDbUrl(0)).toBeNull();
        expect(bountyDofensiveUrl(null)).toBeNull();
    });
});

// ─── Siphon (sources mockées) ──────────────────────────────────────────────────
const RONCE_3531 = { ...PREDAGOB, id: 3531, name: { fr: "Ronce animée" }, subareas: [] };
const RONCE_3530 = { ...PREDAGOB, id: 3530, name: { fr: "Ronce" }, subareas: [] };
const RONCE_3555 = { ...PREDAGOB, id: 3555, name: { fr: "Ronce" }, subareas: [] };

/** Sources nominales : une liste par race + la métadonnée Dofensive de chaque id. */
function standardSources(monsters: any[] = [PREDAGOB], raceId = 32) {
    mockDofusDbFetch.mockImplementation(async (path: string) =>
        path.startsWith(`/monsters?race=${raceId}`) ? monsters : []
    );
    mockDofensiveFetch.mockImplementation(async (path: string) => {
        const id = Number(/\/monsters\/(\d+)/.exec(path)?.[1] ?? 0);
        if (id === 4834) return PREDAGOB_META;
        return {
            ...PREDAGOB_META,
            Id: id,
            Name: "Avis",
            Race: { Id: 147, Name: "Avis de recherche alignés" },
            Subareas: [],
        };
    });
}

describe("syncBounties — liste, preuve, écriture", () => {
    it("interroge les 5 races DofusDB (aucun `$select`) et déduplique par id", async () => {
        mockDofusDbFetch.mockImplementation(async (path: string) => {
            if (path.startsWith("/monsters?race=32")) return [PREDAGOB, RONCE_3530];
            if (path.startsWith("/monsters?race=90")) return [RONCE_3530, RONCE_3555]; // 3530 déjà vue
            return [];
        });
        mockDofensiveFetch.mockResolvedValue(PREDAGOB_META);

        const res = await syncBounties();

        const paths = mockDofusDbFetch.mock.calls.map((c) => String(c[0]));
        expect(paths).toEqual([
            "/monsters?race=32&lang=fr&$limit=50",
            "/monsters?race=90&lang=fr&$limit=50",
            "/monsters?race=127&lang=fr&$limit=50",
            "/monsters?race=147&lang=fr&$limit=50",
            "/monsters?race=156&lang=fr&$limit=50",
        ]);
        expect(paths.some((p) => p.includes("$select"))).toBe(false);
        expect(res.entries.map((e) => e.id).sort()).toEqual([3530, 3555, 4834]);
        expect(res.perRace).toEqual({ "32": 2, "90": 2 });
    });

    it("écrit la fiche avec la zone de traque et le repli de carte DÉCLARÉ", async () => {
        standardSources();
        const res = await syncBounties();

        expect(mockDofensiveFetch).toHaveBeenCalledWith("/monsters/4834?lang=fr", "bounty-monster-4834", true);
        expect(res.entries[0]).toMatchObject({
            id: 4834,
            name: "Predagob",
            slug: "predagob-4834",
            level: 190,
            raceId: 32,
            raceName: "Avis de recherche",
            subareaId: 883,
            subareaName: "Nimotopia",
            mapId: 0,
            mapSource: "none",
            validated: true,
        });

        const payload = mockPersist.mock.calls[0][0];
        expect(mockGetMonsterStats).toHaveBeenCalledWith("Predagob", "Nimotopia", true, 4834);
        expect(payload.id).toBe(4834);
        expect(payload.dungeonName).toBe("Nimotopia");
        expect(payload.isBounty).toBe(true);
        expect(payload.preferredMaps).toEqual([]);           // jamais de carte inventée
        expect(payload.bounty).toMatchObject({
            raceId: 32,
            battleMapId: null,
            battleMapSource: "none",
            levelMin: 190,
            levelMax: 190,
            validated: true,
            source: "DOFENSIVE",
        });
        expect(payload.bounty.subarea).toEqual({ id: 883, name: "Nimotopia" });
        expect(payload.bounty.criteria).toContain("Avoir l'étape #1 de la quête #2 en cours");
        expect(payload.spells.length).toBeGreaterThan(0);    // sorts Dofensive fusionnés
    });

    it("homonymes : la fiche est écrite sous l'ID de l'avis, jamais sous celui d'un homonyme", async () => {
        standardSources([RONCE_3530, RONCE_3555]);
        // La source résout par NOM et renvoie... toujours le premier « Ronce » (3530).
        mockGetMonsterStats.mockResolvedValue({
            success: true,
            data: { id: 3530, name: "Ronce", grades: [{ level: 140 }], spells: [{ id: 1, name: "Sort du 3530" }] },
        });

        const res = await syncBounties();

        const written = mockPersist.mock.calls.map((c) => c[0]);
        expect(written.map((p) => p.id).sort()).toEqual([3530, 3555]);
        expect(written.map((p) => p.dofusdbId).sort()).toEqual([3530, 3555]);
        // Le 3555 ne reçoit JAMAIS le contenu résolu par nom pour le 3530 : les sorts restants
        // sont ceux de Dofensive (résolus PAR ID), et le contenu « Sort du 3530 » ne fuit pas.
        const p3555 = written.find((p) => p.id === 3555);
        expect(p3555.name).toBe("Ronce");
        expect(p3555.spells.length).toBeGreaterThan(0);
        expect(p3555.spells.some((s: any) => String(s?.name ?? "").includes("3530"))).toBe(false);
        expect(res.errors.some((e) => e.includes("3530") && e.includes("homonyme"))).toBe(true);
    });

    it("upsert `Bounty` par `dofusdbId` — JAMAIS par nom (3 homonymes « Ronce »)", async () => {
        standardSources([PREDAGOB, RONCE_3530, RONCE_3555, RONCE_3531]);
        const res = await syncBounties();

        const whereArgs = mockFindUniqueBounty.mock.calls.map((c) => c[0]?.where);
        expect(whereArgs).toContainEqual({ dofusdbId: 4834 });
        expect(whereArgs).toContainEqual({ dofusdbId: 3530 });
        expect(whereArgs).toContainEqual({ dofusdbId: 3555 });
        expect(whereArgs.some((w: any) => w && "name" in w)).toBe(false);

        const created = mockCreateBounty.mock.calls.map((c) => c[0].data);
        expect(created.map((d) => d.dofusdbId)).toEqual([4834, 3530, 3555, 3531]);
        expect(created.find((d) => d.dofusdbId === 3530).slug).toBe("ronce-3530");
        expect(created.find((d) => d.dofusdbId === 3555).slug).toBe("ronce-3555");
        for (const d of created) {
            expect(d.isBountyMonster).toBe(true);
            expect(d.battleMapId).toBeNull();
            expect(d.battleMapSource).toBe("none");
            expect(d.dofusdbSyncedAt).toBeInstanceOf(Date);
        }
        expect(res.synced).toBe(4);
    });

    it("écarte un candidat non prouvé (Dofensive joignable mais pas un avis)", async () => {
        standardSources();
        mockDofensiveFetch.mockResolvedValue({
            ...PREDAGOB_META,
            Race: { Id: 191, Name: "Gardiens des anomalies" },
            Family: { Id: 35, Name: "Créatures des Anomalies Temporelles" },
        });

        const res = await syncBounties();

        expect(res.entries).toEqual([]);
        expect(res.unproven).toBe(1);
        expect(mockCreateBounty).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it("Dofensive injoignable : la liste de la race est CONSERVÉE (validated:false)", async () => {
        standardSources();
        mockDofensiveFetch.mockResolvedValue(null);

        const res = await syncBounties();

        expect(res.entries).toHaveLength(1);
        expect(res.entries[0]).toMatchObject({ id: 4834, validated: false, mapSource: "none" });
        expect(mockPersist.mock.calls[0][0].bounty.source).toBe("DOFUSDB");
        expect(mockPersist.mock.calls[0][0].bounty.validated).toBe(false);
    });

    it("panne DofusDB totale : aucune écriture (jamais destructif)", async () => {
        mockDofusDbFetch.mockResolvedValue(null);
        const res = await syncBounties();

        expect(res.entries).toEqual([]);
        expect(res.errors).toHaveLength(5);          // une erreur par race
        expect(res.perRace).toEqual({});
        expect(mockCreateBounty).not.toHaveBeenCalled();
        expect(mockUpdateBounty).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it("AUCUNE carte n'est siphonnée pour les avis (simulation sur grille vide)", async () => {
        standardSources();
        await syncBounties();
        expect(mockSiphonMap).not.toHaveBeenCalled();
    });

    it("un avis SUPPRIMÉ dans God (liste d'exclusion) n'est ni écrit ni recréé", async () => {
        standardSources();
        mockIgnoredBountyIds.mockReturnValue([4834]);

        const res = await syncBounties();

        expect(res.ignored).toBe(1);                       // compté, donc jamais silencieux
        expect(res.entries).toEqual([]);
        expect(mockCreateBounty).not.toHaveBeenCalled();
        expect(mockUpdateBounty).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it("idempotent : une ligne identique n'est pas comptée comme modifiée", async () => {
        standardSources();
        mockFindUniqueBounty.mockResolvedValue({
            id: "b1",
            level: 190,
            zoneName: "Nimotopia",
            raceId: 32,
            subareaIds: [883],
            isBountyMonster: true,
            battleMapId: null,
            battleMapSource: "none",
        });

        const res = await syncBounties();

        expect(res.synced).toBe(0);
        expect(res.unchanged).toBe(1);
        expect(mockCreateBounty).not.toHaveBeenCalled();
        expect(mockUpdateBounty.mock.calls[0][0].where).toEqual({ id: "b1" });
        // La fraîcheur est rafraîchie à chaque passe (l'UI affiche l'âge de la donnée).
        expect(mockUpdateBounty.mock.calls[0][0].data.dofusdbSyncedAt).toBeInstanceOf(Date);
    });
});


