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
    bountyIdFromLegacySlug,
    bountyLevel,
    bountyLevelRange,
    bountyRaceName,
    bountySlug,
    isBountyRace,
    isBountyRaceName,
    isIdSuffixedBountySlug,
    isProvenBounty,
    pickAdoptableBounty,
    pickBountyBattleMap,
    pickBountySubarea,
    uniqueBountySlug,
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
const mockFindManyBounty = vi.fn(async (..._args: any[]) => [] as unknown[]);
const mockCreateBounty = vi.fn();
const mockUpdateBounty = vi.fn();
const mockUpdateManyBounty = vi.fn(async (..._args: any[]) => ({ count: 1 }));
vi.mock("@/lib/prisma", () => ({
    db: {
        bounty: {
            findMany: (...args: any[]) => mockFindManyBounty(...args),
            findUnique: (...args: any[]) => mockFindUniqueBounty(...args),
            create: (...args: any[]) => mockCreateBounty(...args),
            update: (...args: any[]) => mockUpdateBounty(...args),
            updateMany: (...args: any[]) => mockUpdateManyBounty(...args),
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
vi.mock("@/lib/monster-stats-core", () => ({
    getMonsterStats: (...args: any[]) => mockGetMonsterStats(...args),
}));

const mockGetDofensiveSpells = vi.fn();
vi.mock("@/lib/dofensive-api", () => ({
    getDofensiveSpells: (...args: any[]) => mockGetDofensiveSpells(...args),
}));

/* Liste d'exclusion « avis supprimés dans God » (module fs) : pilotée par le test. */
const mockIgnoredBountyIds = vi.fn();
const mockIgnoredBountyNames = vi.fn();
vi.mock("@/lib/bounty-ignore", () => ({
    getIgnoredBountyIds: (...args: any[]) => mockIgnoredBountyIds(...args),
    isIgnoredBounty: (id: number, ignored?: number[]) => (ignored ?? mockIgnoredBountyIds()).includes(id),
    // 🔶 08/10/2026 — le siphon filtre aussi sur le nom normalisé (lignes historiques
    // sans id) : le mock suit, piloté par `mockIgnoredBountyNames` (vide par défaut).
    getIgnoredBountyNames: (...args: any[]) => mockIgnoredBountyNames(...args),
    isIgnoredBountyName: (name: string, ignoredNames?: string[]) =>
        (ignoredNames ?? mockIgnoredBountyNames()).includes(String(name ?? "").trim().toLowerCase()),
    normalizeBountyName: (name: string | null | undefined) =>
        String(name ?? "").trim().toLowerCase().replace(/\s+/g, " "),
}));

const { syncBounties } = await import("@/lib/bounty-siphon");
// ─── Fixtures ──────────────────────────────────────────────────────────────────
const PREDAGOB = {
    id: 4834,
    name: { fr: "Predagob" },
    gfxId: 1583,
    img: "https://api.dofusdb.fr/img/monsters/1583.png",
    grades: [
        { level: 190, lifePoints: 5200, actionPoints: 12, movementPoints: 4, neutralResistance: 10, earthResistance: 10, fireResistance: 10, waterResistance: 10, airResistance: 10 },
        { level: 190, lifePoints: 5200 },
        { level: 190, lifePoints: 5200 },
        { level: 190, lifePoints: 5200 },
        { level: 190, lifePoints: 5200 },
    ],
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
    mockIgnoredBountyNames.mockReturnValue([]);
    mockDofusDbFetch.mockResolvedValue([]);
    mockDofensiveFetch.mockResolvedValue(null);
    mockFindUniqueBounty.mockResolvedValue(null);
    mockCreateBounty.mockResolvedValue({ id: "b1" });
    mockUpdateBounty.mockResolvedValue({ id: "b1" });
    mockUpdateManyBounty.mockResolvedValue({ count: 1 });
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

    it("slug PROPRE : le nom seul, un suffixe seulement en cas de collision d'homonymes", () => {
        // Décision user du 27/09/2026 : plus d'identifiant dans l'URL (« c'est pas propre »).
        expect(bountySlug("Fojumo")).toBe("fojumo");
        expect(bountySlug("Aermyne 'Braco' Scalptaras")).toBe("aermyne-braco-scalptaras");
        expect(bountySlug("")).toBe("avis");

        // 3 × « Ronce » : l'unicité passe par un suffixe de collision — jamais par l'id DofusDB.
        const taken = new Set<string>(["ronce"]);
        expect(uniqueBountySlug("Ronce", taken)).toBe("ronce-2");
        taken.add("ronce-2");
        expect(uniqueBountySlug("Ronce", taken)).toBe("ronce-3");

        // L'ancienne forme reste RECONNUE : c'est ce qui permet la reprise et le 308.
        expect(isIdSuffixedBountySlug("fojumo-4015", 4015)).toBe(true);
        expect(isIdSuffixedBountySlug("fojumo", 4015)).toBe(false);
        expect(bountyIdFromLegacySlug("fojumo-4015")).toBe(4015);
        expect(bountyIdFromLegacySlug("fojumo")).toBeNull();
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

    /**
     * Adoption (mesure du 27/09/2026 : 83 lignes historiques curées, 91 avis siphonnés vides à
     * côté ⇒ l'upsert par `dofusdbId` seul fabrique un jumeau vide, la curation reste orpheline).
     */
    it("adoption : la ligne historique du même nom est reconnue, une ligne liée ne l'est jamais", () => {
        const rows = [
            { id: "l1", name: "Aigripoil", slug: null, dofusdbId: null, isBountyMonster: false },
            { id: "l2", name: "Mouchâme", slug: null, dofusdbId: null, isBountyMonster: false },
            { id: "l3", name: "Predagob", slug: null, dofusdbId: 4834, isBountyMonster: true },
            { id: "l4", name: "Ronce", slug: null, dofusdbId: null, isBountyMonster: false },
            { id: "l5", name: "Ronce", slug: null, dofusdbId: null, isBountyMonster: false },
            { id: "l6", name: "Sans id mais déjà déclaré avis", slug: null, dofusdbId: null, isBountyMonster: true },
        ];

        // Clé = slug du nom (casse et accents normalisés) : « AIGRIPOIL » ≡ « aigripoil ».
        expect(pickAdoptableBounty(rows, "Aigripoil")?.id).toBe("l1");
        expect(pickAdoptableBounty(rows, "AIGRIPOIL")?.id).toBe("l1");
        expect(pickAdoptableBounty(rows, "mouchâme")?.id).toBe("l2");
        // Une ligne déjà rattachée à un `dofusdbId` appartient à l'avis : jamais adoptée…
        expect(pickAdoptableBounty(rows, "Predagob")).toBeNull();
        // …et une ligne déjà déclarée avis non plus.
        expect(pickAdoptableBounty(rows, "Sans id mais déjà déclaré avis")).toBeNull();
        // Homonymes : ambiguïté ⇒ aucune adoption (jamais de choix au hasard).
        expect(pickAdoptableBounty(rows, "Ronce")).toBeNull();
        // Aucune correspondance, nom vide, entrée nulle : rien à adopter.
        expect(pickAdoptableBounty(rows, "Inconnu")).toBeNull();
        expect(pickAdoptableBounty(rows, "")).toBeNull();
        expect(pickAdoptableBounty(null, "Aigripoil")).toBeNull();
        expect(pickAdoptableBounty(undefined, "Aigripoil")).toBeNull();
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
        // Les 5 listes de races partent en premier, dans l'ordre (aucun `$select`) ;
        // le repli butin ajoute ensuite UN appel `items?` borné par avis sans butin.
        expect(paths.slice(0, 5)).toEqual([
            "/monsters?race=32&lang=fr&$limit=50",
            "/monsters?race=90&lang=fr&$limit=50",
            "/monsters?race=127&lang=fr&$limit=50",
            "/monsters?race=147&lang=fr&$limit=50",
            "/monsters?race=156&lang=fr&$limit=50",
        ]);
        expect(paths.some((p) => p.includes("$select"))).toBe(false);
        expect(paths.filter((p) => p.startsWith("/items?")).length).toBeGreaterThan(0);
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
            slug: "predagob",
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
        // Repli sans appel en plus : la fiche détaillée mockée n'a ni grades ni
        // drops ⇒ relus depuis la liste (même format que `getMonsterStats`).
        expect(payload.grades[0]).toMatchObject({ level: 190, lifePoints: 5200, actionPoints: 12 });
        expect(payload.grades[0].resists.earth).toBe(10);
        expect(payload.drops.map((d: any) => d.objectId).sort()).toEqual([18803, 18803, 26870]);
        expect(res.gradesBackfilled).toBeGreaterThan(0);
        expect(res.dropsBackfilled).toBeGreaterThan(0);
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
        // 🐛 Décision user 27/09/2026 : plus d'identifiant dans l'URL. Les 3 homonymes « Ronce »
        // se distinguent par un **suffixe de collision** (`ronce`, `ronce-2`, `ronce-3`), jamais
        // par l'id DofusDB — l'ancienne forme `ronce-3530` est abandonnée (et redirigée en 308).
        expect(created.find((d) => d.dofusdbId === 3530).slug).toBe("ronce");
        expect(created.find((d) => d.dofusdbId === 3555).slug).toBe("ronce-2");
        // « Ronce animée » (3531) n'est PAS un homonyme : son slug reste proprement dérivé du nom.
        expect(created.find((d) => d.dofusdbId === 3531).slug).toBe("ronce-animee");
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

    it("un avis exclu PAR SON NOM (ligne historique sans id) n'est ni écrit ni recréé", async () => {
        // 🔶 08/10/2026 : une suppression God d'une ligne sans `dofusdbId` enregistre une
        // exclusion par nom (`dofusdbId: 0`) — le siphon doit la filtrer comme un id.
        standardSources();
        mockIgnoredBountyNames.mockReturnValue(["predagob"]);

        const res = await syncBounties();

        expect(res.ignored).toBe(1);
        expect(res.entries).toEqual([]);
        expect(mockCreateBounty).not.toHaveBeenCalled();
        expect(mockUpdateBounty).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it("idempotent : une ligne identique n'est pas comptée comme modifiée", async () => {
        standardSources();
        mockFindUniqueBounty.mockResolvedValue({
            id: "b1",
            name: "Predagob",
            slug: "predagob",
            dofusdbId: 4834,
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

    /**
     * 🐛 Mesure du 27/09/2026 (base locale, `psql`) : **83 lignes `Bounty` historiques** portent
     * TOUTE la curation God (`doplons > 0`, `milice`, `mechanics`, `position`, `dpnlUrl`,
     * `rewards` — 83/83) face à **91 avis siphonnés vides** (`doplons = 0`, aucun texte). Les
     * 15+ paires de même nom le montrent : l'upsert par `dofusdbId` seul créait un **jumeau vide**
     * et la curation restait sur une ligne que les surfaces avis ne servent pas.
     */
    const LEGACY_PREDAGOB = {
        id: "legacy-1",
        name: "Predagob",
        slug: null,
        dofusdbId: null,
        level: 190,
        zoneName: "Nimotopia",
        raceId: null,
        subareaIds: [],
        isBountyMonster: false,
        battleMapId: null,
        battleMapSource: null,
    };

    /** `findMany({ where: { dofusdbId: null } })` (l'adoption) renvoie les lignes pilotées. */
    function legacyRows(rows: any[]) {
        mockFindManyBounty.mockImplementation(async (args: any) =>
            args?.where?.dofusdbId === null ? rows : []
        );
    }

    it("adopte la ligne historique du même nom au lieu de créer un jumeau vide", async () => {
        standardSources();
        legacyRows([LEGACY_PREDAGOB]);

        const res = await syncBounties();

        expect(mockCreateBounty).not.toHaveBeenCalled();
        expect(mockUpdateBounty).not.toHaveBeenCalled();
        const call = mockUpdateManyBounty.mock.calls[0][0];
        // Garde d'état DANS le `WHERE` (invariant anti-course) : la ligne adoptée est bien une
        // ligne SANS rattachement — au moment d'écrire.
        expect(call.where).toEqual({ id: "legacy-1", dofusdbId: null });
        expect(call.data.dofusdbId).toBe(4834);
        expect(call.data.isBountyMonster).toBe(true);
        expect(call.data.slug).toBe("predagob");
        // Le siphon n'écrit QUE ses champs : la curation God n'est jamais dans son payload.
        for (const curated of ["doplons", "milice", "rewardType", "mechanics", "position", "dpnlUrl", "rewards", "mapUrl", "reward"]) {
            expect(call.data).not.toHaveProperty(curated);
        }
        expect(res.synced).toBe(1);
    });

    it("ambiguïté (deux lignes historiques du même nom) : aucune adoption, création de la ligne", async () => {
        standardSources();
        legacyRows([LEGACY_PREDAGOB, { ...LEGACY_PREDAGOB, id: "legacy-2", zoneName: "Autre zone" }]);

        const res = await syncBounties();

        expect(mockUpdateManyBounty).not.toHaveBeenCalled();
        expect(mockCreateBounty).toHaveBeenCalledTimes(1);
        expect(mockCreateBounty.mock.calls[0][0].data.dofusdbId).toBe(4834);
        expect(res.synced).toBe(1);
    });

    it("course perdue (la ligne est prise entre-temps) : le siphon crée la sienne", async () => {
        standardSources();
        legacyRows([LEGACY_PREDAGOB]);
        mockUpdateManyBounty.mockResolvedValue({ count: 0 });

        await syncBounties();

        expect(mockUpdateManyBounty).toHaveBeenCalledTimes(1);
        expect(mockCreateBounty).toHaveBeenCalledTimes(1);
        expect(mockCreateBounty.mock.calls[0][0].data.dofusdbId).toBe(4834);
    });
});

// ─── Réconciliation : lignes orphelines (ni dans les races, ni exclues) ─────
describe("syncBounties — réconciliation des orphelins (passe complète uniquement)", () => {
    /**
     * 🔶 08/10/2026 (bêta : 162 lignes pour 96 avis réels) : le siphon ne supprime
     * JAMAIS (la curation est sacrée) mais SIGNALE les lignes hors races pour la revue
     * God + exclusion en masse. L'adoption (`where.dofusdbId = null`) garde son routage.
     */
    function orphanRows(rows: any[]) {
        mockFindManyBounty.mockImplementation(async (args: any) =>
            args?.where?.dofusdbId === null ? [] : rows
        );
    }

    it("signale les lignes hors races (avec et sans id), sans rien écrire ni supprimer", async () => {
        standardSources();
        orphanRows([
            { id: "junk-1", dofusdbId: 99999, name: "Faux Avis", slug: "faux-avis" },
            { id: "junk-2", dofusdbId: null, name: "Vieux Dopeul", slug: "vieux-dopeul" },
            // Ligne historique du MÊME nom qu'un avis des races : pas orpheline (adoptable).
            { id: "legacy-9", dofusdbId: null, name: "Predagob", slug: "predagob" },
        ]);

        const res = await syncBounties();

        expect(res.orphansComputed).toBe(true);
        expect(res.orphanedTotal).toBe(2);
        expect(res.orphaned.map((o) => o.id).sort()).toEqual(["junk-1", "junk-2"]);
        expect(res.orphaned[0]).toMatchObject({ id: expect.any(String), name: expect.any(String), slug: expect.any(String) });
        // Aucune écriture pour les orphelins (le seul `create` est l'avis réel Predagob).
        expect(mockCreateBounty).toHaveBeenCalledTimes(1);
        expect(mockCreateBounty.mock.calls[0][0].data.dofusdbId).toBe(4834);
        expect(mockUpdateBounty).not.toHaveBeenCalled();
    });

    it("une ligne exclue (id ou nom) n'est jamais remontée comme orpheline", async () => {
        standardSources();
        orphanRows([
            { id: "junk-1", dofusdbId: 99999, name: "Faux Avis", slug: "faux-avis" },
            { id: "junk-2", dofusdbId: null, name: "Vieux Dopeul", slug: "vieux-dopeul" },
        ]);
        mockIgnoredBountyIds.mockReturnValue([99999]);
        mockIgnoredBountyNames.mockReturnValue(["vieux dopeul"]);

        const res = await syncBounties();

        expect(res.orphanedTotal).toBe(0);
        expect(res.orphaned).toEqual([]);
    });

    it("passage par race (bouton God « Ici ») : pas de calcul d'orphelins (faux positifs sinon)", async () => {
        standardSources();
        orphanRows([
            { id: "junk-1", dofusdbId: 99999, name: "Faux Avis", slug: "faux-avis" },
        ]);

        const res = await syncBounties([32]);

        expect(res.orphansComputed).toBe(false);
        expect(res.orphaned).toEqual([]);
        expect(res.orphanedTotal).toBe(0);
    });
});

// ─── Périmètre : les 5 races DofusDB « Avis de recherche » ───────────────────
describe("périmètre avis — 5 races DofusDB, aucune autre", () => {
    /**
     * 🔶 Mesuré le 09/10/2026 (`monster-races?superRaceId=27` : 13 races, dont 5
     * « Avis/Kopfgeld/Wanted ») : 32 (classiques, 38) · 90 (Frigost, 21) ·
     * 127 (Dimensions, 15) · 147 (alignés, 19) · 156 (Sufokia, 3) = 96 avis.
     * Les libellés « Créatures de quête — Avis de … » sont côté Dofensive (preuve,
     * famille 27), pas des races manquantes. Ce test verrouille le périmètre : toute
     * nouvelle race d'avis doit être ajoutée ici consciemment (avec son libellé).
     */
    it("BOUNTY_RACE_IDS = les 5 races, dans l'ordre stable", async () => {
        const { BOUNTY_RACE_IDS, BOUNTY_RACE_NAMES } = await import("@/lib/bounty");
        expect([...BOUNTY_RACE_IDS]).toEqual([32, 90, 127, 147, 156]);
        expect(BOUNTY_RACE_NAMES).toMatchObject({
            32: "Avis de recherche",
            90: "Avis de recherche de Frigost",
            127: "Avis de recherche des Dimensions",
            147: "Avis de recherche alignés",
            156: "Avis de recherche de Sufokia",
        });
    });
});


