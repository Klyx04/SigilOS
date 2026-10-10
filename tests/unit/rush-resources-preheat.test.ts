/**
 * 🔥 Gardes du **pré-chauffage des icônes du guide Rush Sylvestre** (10/10/2026).
 *
 * 🐛 Constat user : « les ressources quand on ouvre la fenêtre des +300 ressources des guides
 * sylvestres on voit des espèces de chargement » — la modale « Ressources à prévoir » demande
 * d'abord le WebP local, absent après la purge ⇒ des centaines de 404, puis le proxy (budget
 * partagé de 30 req/min) : les icônes arrivent une par une.
 *
 * 🔒 Ce que ce test verrouille **en priorité** : on ne devine **jamais** le chemin d'image d'un
 * objet. L'id de fichier local est l'id d'**entité** ; `/img/items/*` est indexé par id
 * d'**apparence** (mesure du 09/10/2026 : objet 11107 → iconId 38677). Le chemin deviné peut
 * répondre 200 avec l'icône d'un AUTRE objet, gravée ensuite pour un an.
 *
 * Aucun I/O réel : `fs`, `sharp`, le limiteur DofusDB et le journal sont mockés, `fetch` est stubé.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
// ⚠️ `node:fs` (et NON `fs`, mocké plus bas) : les gardes de source doivent lire les **vrais**
// fichiers, indépendamment des mocks d'I/O du cœur.
import { readFileSync } from "node:fs";
import {
    GUIDE_ICON_CHUNK_SIZE,
    chunkItemIconIds,
    guideResourceNumericIds,
    splitMissingGuideIcons,
} from "@/lib/rush-resources-preheat";
import { isLocalThrottleDeferredMessage } from "@/lib/dofusdb-throttle";

const read = (path: string) => readFileSync(path, "utf8");

/**
 * 🛡️ Le **code**, sans la prose : une garde de source verrouille le code, jamais un commentaire
 * (le module pur *explique* qu'il n'importe pas le cœur d'assets — la garde ne doit pas le lire).
 */
const codeOf = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Chemins des fichiers verrouillés par les gardes de source (hors des `describe`, partagés). */
const PURE = "src/lib/rush-resources-preheat.ts";
const ASSETS = "src/lib/dofus-asset-siphon.ts";
const RUNNERS = "src/components/admin/game-data-inline-runners.ts";
const PANEL = "src/components/admin/GameDataSiphonPanel.tsx";
const ACTIONS = "src/server/actions/asset-siphon-actions.ts";

const mockExistsSync = vi.fn();
const mockStatSync = vi.fn();
const mockMkdirSync = vi.fn();
// 🧩 Mock **partiel** : le cœur n'a besoin que de l'existence/écriture, mais les gardes de source
// doivent lire les VRAIS fichiers — Vitest aliase `node:fs` sur `fs`, d'où `importOriginal`.
vi.mock("fs", async (importOriginal) => {
    const actual = (await importOriginal()) as typeof import("fs");
    const overrides = {
        existsSync: (...args: any[]) => mockExistsSync(...args),
        statSync: (...args: any[]) => mockStatSync(...args),
        mkdirSync: (...args: any[]) => mockMkdirSync(...args),
    };
    return { ...actual, ...overrides, default: { ...actual, ...overrides } };
});

const mockSharpToFile = vi.fn();
vi.mock("sharp", () => ({
    default: vi.fn(() => ({ webp: () => ({ toFile: mockSharpToFile }) })),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Limiteur partagé = passe-plat : aucune fenêtre de 30 req/min dans un test (déterminisme).
vi.mock("@/lib/dofusdb-limiter", () => ({
    dofusDbFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));

vi.mock("@/lib/game-data-changelog", () => ({
    recordGameDataChanges: vi.fn(),
}));

import { siphonAndCompressImage, siphonItemIconsBatchCore } from "@/lib/dofus-asset-siphon";

function imageResponse() {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => new Uint8Array(200).buffer,
    } as any;
}

/** Réponse JSON DofusDB (fiche d'objet). */
function jsonResponse(payload: unknown) {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => payload,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockStatSync.mockReturnValue({ size: 500 });
    mockSharpToFile.mockResolvedValue(undefined);
    vi.unstubAllGlobals();
});

describe("pré-chauffage — sélection des cibles (pur)", () => {
    it("ne garde que les ids numériques exploitables, dédupliqués et triés", () => {
        expect(
            guideResourceNumericIds([
                { id: "15190" },
                { id: "9289" },
                { id: "15190" }, // doublon
                { id: null },
                { id: "" },
                { id: "Tougli" }, // non numérique : servi par le proxy, pas pré-chauffable
                { id: "0" },
                { id: "-3" },
                {},
            ]),
        ).toEqual([9289, 15190]);
    });

    it("sépare ce qui manque de ce qui est déjà sur disque (existence injectée)", () => {
        const { missing, present } = splitMissingGuideIcons([1, 2, 3, 4], (id) => id % 2 === 0);
        expect(missing).toEqual([1, 3]);
        expect(present).toEqual([2, 4]);
    });

    it("découpe en tranches courtes (jamais de tranche vide, taille bornée à 1)", () => {
        expect(chunkItemIconIds([])).toEqual([]);
        expect(chunkItemIconIds([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
        expect(chunkItemIconIds([1, 2], 0)).toEqual([[1], [2]]);
        expect(GUIDE_ICON_CHUNK_SIZE).toBeGreaterThan(0);
        expect(GUIDE_ICON_CHUNK_SIZE).toBeLessThanOrEqual(25);
    });
});

describe("pré-chauffage — on ne devine JAMAIS le chemin d'une icône d'objet", () => {
    it("objet : la fiche /items/{id} est interrogée, jamais /img/items/{id}.png", async () => {
        // DofusDB répond 200 avec un AUTRE item quand l'id demandé n'existe pas (item de repli).
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 666, iconId: 38677 }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await siphonItemIconsBatchCore([15190]);
        const urls = fetchMock.mock.calls.map((c) => String(c[0]));

        // ⭐ L'invariant : le chemin deviné (id d'ENTITÉ) n'est jamais demandé.
        expect(urls).not.toContain("https://api.dofusdb.fr/img/items/15190.png");
        expect(urls).toContain("https://api.dofusdb.fr/items/15190");
        // La garde d'identité refuse l'item de repli (id 666 ≠ 15190) ⇒ échec NOMMÉ, rien gravé.
        expect(res.siphoned).toBe(0);
        expect(res.errors).toBe(1);
        expect(res.details[0]).toContain("#15190");
    });

    it("objet : l'image vient de l'APPARENCE (iconId) renvoyée par l'API", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ id: 15190, iconId: 9289 }))
            .mockResolvedValue(imageResponse());
        vi.stubGlobal("fetch", fetchMock);

        const res = await siphonItemIconsBatchCore([15190]);
        const urls = fetchMock.mock.calls.map((c) => String(c[0]));

        expect(res.siphoned).toBe(1);
        expect(res.errors).toBe(0);
        expect(urls).toContain("https://api.dofusdb.fr/items/15190");
        expect(urls).toContain("https://api.dofusdb.fr/img/items/9289.png");
        expect(urls).not.toContain("https://api.dofusdb.fr/img/items/15190.png");
    });

    it("contraste : sans l'option, le même appel DEVINE le chemin (d'où l'existence de la garde)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(imageResponse());
        vi.stubGlobal("fetch", fetchMock);

        await siphonAndCompressImage(null, "items", 15190);

        expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.dofusdb.fr/img/items/15190.png");
    });
});

describe("pré-chauffage — passe idempotente et honnête", () => {
    it("id déjà sur disque : aucun appel réseau", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        mockExistsSync.mockReturnValue(true);

        const res = await siphonItemIconsBatchCore([15190]);

        expect(res.skipped).toBe(1);
        expect(res.siphoned).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("un id illisible est compté et NOMMÉ (jamais ignoré en silence)", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await siphonItemIconsBatchCore([Number.NaN, -1, 0]);

        expect(res.skipped).toBe(3);
        expect(res.details).toHaveLength(3);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("pré-chauffage — câblage (gardes de source)", () => {
    it("la cadence reste PURE : aucun import du module d'assets (sinon `sharp` part au navigateur)", () => {
        const pure = codeOf(read(PURE));
        expect(pure).not.toContain("dofus-asset-siphon");
        expect(pure).not.toContain("sharp");
        // Le lanceur « dans l'onglet » n'importe QUE cette cadence.
        expect(read(RUNNERS)).toContain('from "@/lib/rush-resources-preheat"');
        expect(read(RUNNERS)).not.toContain('from "@/lib/dofus-asset-siphon"');
    });

    it("le cœur sort AVANT tout réseau si le fichier est là, et la porte reste fermée au chemin deviné", () => {
        const assets = read(ASSETS);
        expect(assets).toContain("allowGuessedPath: false");
        // La garde est réellement appliquée dans le siphon partagé (Tentative 1 conditionnelle).
        expect(assets).toContain("opts.allowGuessedPath !== false");
        // Idempotence : la vérification disque précède l'appel réseau.
        const core = assets.slice(assets.indexOf("export async function siphonItemIconsBatchCore"));
        expect(core.indexOf("getLocalAssetUrl('items', id, null)")).toBeLessThan(
            core.indexOf("siphonAndCompressImage(null, 'items', id"),
        );
    });

    it("le lanceur route les cibles d'OBJETS vers la voie objets (même rail de progression)", () => {
        const runners = read(RUNNERS);
        expect(runners).toContain('kind?: "monsters" | "items"');
        expect(runners).toContain("triggerBatchItemIconSiphonAction(chunk)");
        expect(runners).toContain("chunkItemIconIds(itemIds)");
        expect(runners).toContain("await ctx.report(done, total");
    });

    it("les actions sont gardées et bornées à une tranche", () => {
        const actions = read(ACTIONS);
        expect(actions).toContain("export async function getGuideResourceIconTargets");
        expect(actions).toContain("export async function triggerBatchItemIconSiphonAction");
        expect(actions).toContain("slice(0, GUIDE_ICON_CHUNK_SIZE)");
        expect(actions.match(/canManageSiphon\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
        // Les cibles viennent de LA source d'agrégation des écrans (aucune 2ᵉ liste à tenir).
        expect(actions).toContain("aggregateRushResources(milestones)");
    });

    it("le panneau God porte le bouton (une seule porte : le lanceur partagé)", () => {
        const panel = read(PANEL);
        expect(panel).toContain("handlePreheatGuideIcons");
        expect(panel).toContain("getGuideResourceIconTargets()");
        expect(panel).toContain("kind: 'items' as const");
        expect(panel).toContain("runInlineGameDataDataset('ASSETS_WEBP'");
        expect(panel).toContain("Pré-chauffer les icônes du guide");
    });
});

/**
 * 🐛 Mesure du 10/10/2026 (bêta) : **391/391 icônes « en échec »** alors que DofusDB répondait
 * parfaitement (mesuré : `/items/11107` → `iconId` 38677, 30 ms). La cause n'était pas l'asset mais
 * **notre propre budget partagé** (30 req/min) consommé par un autre siphon : `dofusDbFetch` rend
 * alors un **faux 429 local**, que le cœur traduisait en « Impossible de récupérer l'image ».
 * Ces gardes verrouillent la distinction — un budget épuisé est un « reviens plus tard », pas un
 * asset manquant (même leçon que le 28/09/2026 sur les Items).
 */
describe("pré-chauffage — un budget partagé épuisé n'est PAS un asset manquant", () => {
    /** Le refus **local** du limiteur : 429 + en-tête `x-sigilos-throttle: local`. */
    const localThrottle = (retryAfter?: string) =>
        ({
            ok: false,
            status: 429,
            headers: new Headers({
                "x-sigilos-throttle": "local",
                ...(retryAfter ? { "retry-after": retryAfter } : {}),
            }),
        }) as any;

    it("refus local → différé typé, jamais « impossible de récupérer l'image »", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(localThrottle("12")));

        const res = await siphonAndCompressImage(null, "items", 15190, false, { allowGuessedPath: false });

        expect(res.success).toBe(false);
        expect(isLocalThrottleDeferredMessage(res.error)).toBe(true);
        expect(res.retryAfterMs).toBe(12_000); // `retry-after` du limiteur honoré
        expect(String(res.error)).not.toContain("Impossible de récupérer");
    });

    it("la tranche s'arrête au PREMIER refus local (pas 10 faux échecs d'affilée)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(localThrottle());
        vi.stubGlobal("fetch", fetchMock);

        const res = await siphonItemIconsBatchCore([464, 466, 468, 470]);

        expect(res.deferred).toBe(true);
        expect(res.errors).toBe(0); // ⭐ aucun faux échec
        expect(res.siphoned).toBe(0);
        expect(res.details).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(1); // ⭐ un seul appel : on ne brûle pas la tranche
    });

    it("un 429 de DofusDB (pas local) reste un échec NOMMÉ, jamais un différé", async () => {
        const real429 = { ok: false, status: 429, headers: new Headers() } as any;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(real429));

        const res = await siphonItemIconsBatchCore([464]);

        expect(res.deferred).toBeUndefined();
        expect(res.errors).toBe(1);
        expect(res.details[0]).toContain("#464");
        expect(res.details[0]).toContain("429"); // la cause réelle est NOMMÉE
    });

    it("le lanceur attend la fin de fenêtre puis rejoue la MÊME tranche (patron des Items)", () => {
        const runners = read(RUNNERS);
        expect(runners).toContain("data?.deferred");
        expect(runners).toContain("const data = res.data;");
        expect(runners).toContain("data.retryAfterMs ?? INLINE_THROTTLE_WAIT_MS");
        expect(runners).toContain("res = await triggerBatchItemIconSiphonAction(chunk)");
        expect(runners).toContain("budgetStopped");
        // …et l'interruption est annoncée (avertissement), pas peinte en échec.
        expect(runners).toContain("deferred: budgetStopped || undefined");
        expect(read(PANEL)).toContain("toast.warning(res.summary)");
    });

    it("le siphon d'assets distingue le refus local AVANT de conclure à un asset absent", () => {
        const assets = read(ASSETS);
        expect(assets).toContain("if (isLocalThrottle(providedRes))");
        expect(assets).toContain("if (isLocalThrottle(itemRes))");
        expect(assets).toContain("new LocalThrottleDeferredError(retryAfterMs).message");
        // La core s'arrête sur ce message (jamais compté en erreur).
        const core = assets.slice(assets.indexOf("export async function siphonItemIconsBatchCore"));
        expect(core).toContain("isLocalThrottleDeferredMessage(res.error)");
        expect(core).toContain("result.deferred = true;");
    });
});
