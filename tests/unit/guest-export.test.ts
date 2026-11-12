/**
 * Guide public — **export / import de la progression locale** (chantier 4, F2).
 *
 * Ce que ce verrou protège :
 *
 * 1. **aller-retour complet** : les cinq clés de progression, le personnage et la route
 *    d'alignement reviennent à l'identique — un export partiel serait une fausse sauvegarde ;
 * 2. **refus net** : format, version, guide, bornes, état de donjon, serveur absurde — un
 *    fichier douteux n'écrit **rien** ;
 * 3. **aucun secret** : ni clé Metamob, ni identifiant SigilOS dans le fichier, même si on
 *    en glisse un (les champs inconnus ne sont jamais recopiés) ;
 * 4. **mêmes clés que le guide** : l'export lit les helpers de `guest-progress`, pas une
 *    copie de chaînes qui divergerait.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
    GUEST_EXPORT_FORMAT,
    GUEST_EXPORT_GUIDE,
    GUEST_EXPORT_VERSION,
    applyGuestExport,
    collectGuestExport,
    parseGuestExport,
    type GuestExport,
} from "@/lib/guest-export";
import {
    guestCharacterStorageKey,
    guestProgressPrefix,
    guestRouteOrderStorageKey,
    guestRouteStorageKey,
    type GuestCharacter,
} from "@/lib/guest-progress";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
        return store.size;
    },
});

const SLUG = GUEST_EXPORT_GUIDE;
const CHARACTER: GuestCharacter = { classId: "iop", pseudo: "MonIop", serverId: 295 };

const VALID: GuestExport = {
    format: GUEST_EXPORT_FORMAT,
    version: GUEST_EXPORT_VERSION,
    guide: GUEST_EXPORT_GUIDE,
    exportedAt: "2026-11-11T00:00:00.000Z",
    character: CHARACTER,
    route: { camp: "bontarien", order: "vaillant" },
    progress: {
        completedMilestones: ["o1", "e1"],
        completedSteps: { o1: ["s1", "s2"] },
        bookmarks: { o1: "s2" },
        dungeonChecks: { "q::d": "done" },
        resourceChecks: ["r1", "r2"],
    },
};

beforeEach(() => {
    store.clear();
});

describe("F2 — l'aller-retour rend exactement ce qui est parti", () => {
    it("exporte les cinq clés, le personnage et la route", () => {
        const prefix = guestProgressPrefix(SLUG, CHARACTER);
        localStorage.setItem(guestCharacterStorageKey(SLUG), JSON.stringify(CHARACTER));
        localStorage.setItem(`${prefix}completed_ms`, JSON.stringify(["o1", "e1"]));
        localStorage.setItem(`${prefix}steps`, JSON.stringify({ o1: ["s1", "s2"] }));
        localStorage.setItem(`${prefix}bookmarks`, JSON.stringify({ o1: "s2" }));
        localStorage.setItem(`${prefix}dungeons`, JSON.stringify({ "q::d": "done" }));
        localStorage.setItem(`${prefix}resources`, JSON.stringify(["r1", "r2"]));
        localStorage.setItem(guestRouteStorageKey(SLUG), "bontarien");
        localStorage.setItem(guestRouteOrderStorageKey(SLUG), "vaillant");

        const data = collectGuestExport(SLUG, CHARACTER);
        expect(data).not.toBeNull();
        expect(data!.character).toEqual(CHARACTER);
        expect(data!.route).toEqual({ camp: "bontarien", order: "vaillant" });
        expect(data!.progress).toEqual(VALID.progress);
    });

    it("réimporte tout sur un stockage vide", () => {
        expect(applyGuestExport(SLUG, VALID)).toBe(true);
        const prefix = guestProgressPrefix(SLUG, CHARACTER);
        expect(JSON.parse(localStorage.getItem(guestCharacterStorageKey(SLUG))!)).toEqual(CHARACTER);
        expect(JSON.parse(localStorage.getItem(`${prefix}completed_ms`)!)).toEqual(["o1", "e1"]);
        expect(JSON.parse(localStorage.getItem(`${prefix}steps`)!)).toEqual({ o1: ["s1", "s2"] });
        expect(JSON.parse(localStorage.getItem(`${prefix}bookmarks`)!)).toEqual({ o1: "s2" });
        expect(JSON.parse(localStorage.getItem(`${prefix}dungeons`)!)).toEqual({ "q::d": "done" });
        expect(JSON.parse(localStorage.getItem(`${prefix}resources`)!)).toEqual(["r1", "r2"]);
        expect(localStorage.getItem(guestRouteStorageKey(SLUG))).toBe("bontarien");
        expect(localStorage.getItem(guestRouteOrderStorageKey(SLUG))).toBe("vaillant");
    });

    it("un fichier sans personnage écrit l'emplacement anonyme et retire le personnage", () => {
        localStorage.setItem(guestCharacterStorageKey(SLUG), JSON.stringify(CHARACTER));
        expect(applyGuestExport(SLUG, { ...VALID, character: null, route: { camp: null, order: null } })).toBe(true);
        expect(localStorage.getItem(guestCharacterStorageKey(SLUG))).toBeNull();
        const anonymousPrefix = guestProgressPrefix(SLUG, null);
        expect(JSON.parse(localStorage.getItem(`${anonymousPrefix}completed_ms`)!)).toEqual(["o1", "e1"]);
        expect(localStorage.getItem(guestRouteStorageKey(SLUG))).toBeNull();
    });

    it("n'exporte RIEN si une clé locale est illisible (pas de demi-sauvegarde)", () => {
        localStorage.setItem(`${guestProgressPrefix(SLUG, CHARACTER)}completed_ms`, "{pas du json");
        expect(collectGuestExport(SLUG, CHARACTER)).toBeNull();
    });
});

describe("F2 — un fichier douteux n'écrit rien", () => {
    const rejected: Array<[string, unknown]> = [
        ["format inconnu", { ...VALID, format: "autre.format" }],
        ["version inconnue", { ...VALID, version: 2 }],
        ["mauvais guide", { ...VALID, guide: "un-autre-guide" }],
        ["serveur absurde", { ...VALID, character: { ...CHARACTER, serverId: 0 } }],
        ["serveur non entier", { ...VALID, character: { ...CHARACTER, serverId: 1.5 } }],
        [
            "état de donjon inconnu",
            { ...VALID, progress: { ...VALID.progress, dungeonChecks: { "q::d": "peut-etre" } } },
        ],
        ["route inconnue", { ...VALID, route: { camp: "neutre", order: null } }],
        ["pas un objet", "{}"],
        ["rien", null],
    ];

    for (const [label, raw] of rejected) {
        it(`refuse ${label}`, () => {
            expect(parseGuestExport(raw)).toBeNull();
        });
    }

    it("refuse des listes au-delà des bornes du guide", () => {
        const tooManyMilestones = {
            ...VALID,
            progress: {
                ...VALID.progress,
                completedMilestones: Array.from({ length: 301 }, (_, i) => `ms-${i}`),
            },
        };
        expect(parseGuestExport(tooManyMilestones)).toBeNull();

        const tooManySteps = {
            ...VALID,
            progress: {
                ...VALID.progress,
                completedSteps: Object.fromEntries(
                    Array.from({ length: 301 }, (_, i) => [`ms-${i}`, []])
                ),
            },
        };
        expect(parseGuestExport(tooManySteps)).toBeNull();

        const tooManyResources = {
            ...VALID,
            progress: {
                ...VALID.progress,
                resourceChecks: Array.from({ length: 2_001 }, (_, i) => `r-${i}`),
            },
        };
        expect(parseGuestExport(tooManyResources)).toBeNull();
    });

    it("ignore un champ inconnu (clé Metamob, identifiant) au lieu de le recopier", () => {
        const parsed = parseGuestExport({
            ...VALID,
            metamobApiKey: "cle-secrete",
            userId: "user-123",
        });
        expect(parsed).not.toBeNull();
        expect(JSON.stringify(parsed)).not.toContain("cle-secrete");
        expect(JSON.stringify(parsed)).not.toContain("user-123");
    });

    it("un import refusé ne touche pas au stockage existant", () => {
        localStorage.setItem(guestCharacterStorageKey(SLUG), JSON.stringify(CHARACTER));
        // `applyGuestExport` ne reçoit que des données déjà validées : un guide étranger suffit.
        expect(applyGuestExport("autre-guide", VALID)).toBe(false);
        expect(localStorage.getItem(guestCharacterStorageKey(SLUG))).not.toBeNull();
    });
});

describe("F2 — le guide expose la sauvegarde aux anonymes seulement", () => {
    const CLIENT = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
    const LIB = "src/lib/guest-export.ts";
    const client = stripComments(read(CLIENT));
    const lib = stripComments(read(LIB));

    it("branche l'export et l'import sur la même lib", () => {
        expect(client).toContain("collectGuestExport(guide.slug, character)");
        expect(client).toContain("parseGuestExport(raw)");
        expect(client).toContain("applyGuestExport(guide.slug, data)");
    });

    it("les deux entrées vivent derrière `!visitor` (un compte a déjà la base)", () => {
        expect(client).toMatch(/\{!visitor \? \([\s\S]{0,500}Exporter ma progression/);
        expect(client).toContain("Importer une sauvegarde");
    });

    it("l'import dit qu'il REMPLACE la progression", () => {
        expect(client).toContain("remplace la progression de ce personnage");
    });

    it("le fichier est borné AVANT d'être lu", () => {
        expect(client).toContain("GUEST_EXPORT_MAX_BYTES");
        expect(client).toContain("file.size > GUEST_EXPORT_MAX_BYTES");
    });

    it("les clés de route viennent des helpers, jamais d'une chaîne recopiée", () => {
        expect(client).toContain("guestRouteStorageKey(guide.slug)");
        expect(client).toContain("guestRouteOrderStorageKey(guide.slug)");
        expect(client).not.toContain("sigilos_rush_route_${");
    });

    it("aucun secret dans le module d'export", () => {
        expect(lib).not.toMatch(/metamob|userId|apiKey/i);
    });
});

