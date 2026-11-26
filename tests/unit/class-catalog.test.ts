import { describe, expect, it } from "vitest";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import {
    buildClassCatalogManifest,
    classSlug,
    diffClassCatalog,
    normalizeBreedSnapshot,
    summarizeClassCatalogDiff,
    type ClassCatalogManifest,
} from "@/lib/class-catalog";

const LIVE_BREEDS = DOFUS_CLASSES.filter((c) => !("preview" in c && c.preview)).map((c) => c.breed);

function row(breed: number, name: string, spellCount = 22) {
    return {
        id: breed,
        shortName: { fr: name, en: name },
        img: `https://api.dofusdb.fr/img/breeds/symbol_${breed}.png`,
        breedSpellsId: Array.from({ length: spellCount }, (_, i) => i + 1),
    };
}

function liveRows() {
    return LIVE_BREEDS.map((breed) => {
        const cls = DOFUS_CLASSES.find((c) => c.breed === breed)!;
        return row(breed, cls.name);
    });
}

const BELLA = row(21, "Bellaphone");

function baseline(overrides: {
    prodRows?: unknown[];
    betaRows?: unknown[] | null;
    now?: string;
} = {}): ClassCatalogManifest {
    return buildClassCatalogManifest({
        previous: null,
        prodRows: overrides.prodRows ?? liveRows(),
        betaRows: overrides.betaRows ?? [...liveRows(), BELLA],
        now: overrides.now ?? "2026-11-26T00:00:00.000Z",
    });
}

describe("class-catalog — normalisation", () => {
    it("slugifie proprement les accents et les espaces", () => {
        expect(classSlug("Bellaphone")).toBe("bellaphone");
        expect(classSlug("Féca")).toBe("feca");
        expect(classSlug("  Éliotrope  ")).toBe("eliotrope");
    });

    it("normalise une ligne /breeds et ignore une ligne sans id ou sans nom", () => {
        const snap = normalizeBreedSnapshot(BELLA, "beta", "2026-11-26T00:00:00.000Z");
        expect(snap).toMatchObject({
            breed: 21,
            name: "Bellaphone",
            slug: "bellaphone",
            spellCount: 22,
        });
        expect(snap?.iconUrl).toContain("symbol_21.png");

        expect(normalizeBreedSnapshot({ id: 0, shortName: { fr: "X" } }, "prod", "t")).toBeNull();
        expect(normalizeBreedSnapshot({ id: 3 }, "prod", "t")).toBeNull();
    });
});

describe("class-catalog — manifeste prod/bêta", () => {
    it("la prod fait foi et une classe bêta seule est preview", () => {
        const manifest = baseline();
        expect(manifest.prodTotal).toBe(LIVE_BREEDS.length);
        expect(manifest.betaTotal).toBe(LIVE_BREEDS.length + 1);

        const bella = manifest.classes.find((c) => c.breed === 21)!;
        expect(bella.status).toBe("preview");
        expect(bella.inCode).toBe(true);
        expect(bella.codeId).toBe("bellaphone");
        expect(bella.codeDofusbookId).toBe(20);
        expect(bella.prod).toBeNull();
        expect(bella.beta?.name).toBe("Bellaphone");
        // Classe du code : l'icône statique du dépôt reste la référence.
        expect(bella.localIcon).toBe("/assets/dofus/classes/21.png");
        expect(manifest.codeMissingFromSources).toEqual([]);
    });

    it("une classe bêta-only hors code reçoit un chemin d'icône volume", () => {
        const manifest = baseline({ betaRows: [...liveRows(), BELLA, row(99, "Nouvelle Classe")] });
        const newClass = manifest.classes.find((c) => c.breed === 99)!;
        expect(newClass.status).toBe("preview");
        expect(newClass.inCode).toBe(false);
        expect(newClass.localIcon).toBe("/uploads/assets-dofus/classes/99.webp");
    });

    it("ne construit jamais un manifeste sur une prod vide (panne ≠ suppression)", () => {
        expect(() =>
            buildClassCatalogManifest({
                previous: null,
                prodRows: [],
                betaRows: [BELLA],
                now: "t",
            }),
        ).toThrow(/prod a renvoyé 0 classe/);
    });

    it("bêta indisponible : conserve le snapshot bêta précédent et ne retire rien", () => {
        const first = baseline({ now: "2026-11-26T00:00:00.000Z" });
        const second = buildClassCatalogManifest({
            previous: first,
            prodRows: liveRows(),
            betaRows: null,
            now: "2026-11-27T00:00:00.000Z",
        });
        const bella = second.classes.find((c) => c.breed === 21)!;
        expect(bella.status).toBe("preview");
        expect(bella.beta?.seenAt).toBe("2026-11-26T00:00:00.000Z");
        expect(second.betaTotal).toBe(0);
    });
});

describe("class-catalog — diff et journal", () => {
    it("le premier passage est une baseline silencieuse", () => {
        const manifest = baseline();
        const diff = diffClassCatalog(null, manifest);
        expect(diff.changes).toEqual([]);
        expect(summarizeClassCatalogDiff(diff, manifest)).toBe("Aucun changement");
    });

    it("détecte une nouvelle classe preview sans la retirer du code", () => {
        const previous = baseline({ betaRows: liveRows() });
        const next = baseline({ now: "2026-11-27T00:00:00.000Z" });
        const diff = diffClassCatalog(previous, next);
        expect(diff.newPreview).toEqual(["Bellaphone"]);
        expect(diff.missingFromCode).toEqual([]);
        expect(diff.changes[0]?.changeType).toBe("NEW");
        expect(diff.changes[0]?.entityId).toBe("21");
    });

    it("détecte le passage preview → live (prod prend la main)", () => {
        const previous = baseline({ now: "2026-11-26T00:00:00.000Z" });
        const next = baseline({
            prodRows: [...liveRows(), BELLA],
            betaRows: [...liveRows(), BELLA],
            now: "2026-12-05T00:00:00.000Z",
        });
        const bella = next.classes.find((c) => c.breed === 21)!;
        expect(bella.status).toBe("live");
        const diff = diffClassCatalog(previous, next);
        const change = diff.changes.find((c) => c.entityId === "21")!;
        expect(change.changeType).toBe("MODIFIED");
        expect(change.scope).toBe("mixed");
        expect(change.fields.status).toEqual({ before: "preview", after: "live" });
    });

    it("une disparition devient REMOVED, jamais une suppression de l'entrée", () => {
        const previous = baseline();
        const next = buildClassCatalogManifest({
            previous,
            prodRows: liveRows().filter((r) => r.id !== 9),
            betaRows: [...liveRows().filter((r) => r.id !== 9), BELLA],
            now: "2026-11-27T00:00:00.000Z",
        });
        const cra = next.classes.find((c) => c.breed === 9)!;
        expect(cra.status).toBe("retired");
        const diff = diffClassCatalog(previous, next);
        expect(diff.removed).toEqual(["Cra"]);
        expect(diff.changes.find((c) => c.entityId === "9")?.changeType).toBe("REMOVED");
        // L'entrée existe toujours dans le manifeste.
        expect(next.classes.some((c) => c.breed === 9)).toBe(true);
    });

    it("une classe preview qui arrive en prod avec un autre nom reste un changement prod", () => {
        const previous = baseline();
        // 21 est preview dans la baseline : la prod arrive avec un nom différent.
        const next = buildClassCatalogManifest({
            previous,
            prodRows: [
                ...liveRows(),
                { ...BELLA, shortName: { fr: "Bellaphone Prime", en: "Bellaphone Prime" } },
            ],
            betaRows: [...liveRows(), BELLA],
            now: "2026-12-05T00:00:00.000Z",
        });
        const diff = diffClassCatalog(previous, next);
        const change = diff.changes.find((c) => c.entityId === "21")!;
        expect(change.fields.prod).toMatchObject({
            before: null,
            after: { name: "Bellaphone Prime" },
        });
        expect(change.fields.status).toEqual({ before: "preview", after: "live" });
    });
});
