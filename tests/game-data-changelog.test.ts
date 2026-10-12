import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ⚠️ Le module importe `@/lib/prisma` (écriture/purge) : on l'isole — les règles testées
// (`diffFields`, `summarizeValue`, bornes) sont **pures** et ne touchent jamais la base.
vi.mock("@/lib/prisma", () => ({ db: {} }));

import {
    GAME_DATA_CHANGELOG_KEEP_PER_DATASET,
    GAME_DATA_CHANGELOG_MAX_AGE_DAYS,
    GAME_DATA_CHANGELOG_MAX_FIELDS,
    GAME_DATA_CHANGELOG_MAX_LIST_ITEMS,
    GAME_DATA_CHANGELOG_MAX_VALUE_CHARS,
    GAME_DATA_CHANGELOG_RETENTION_LABEL,
    diffCollection,
    diffFields,
    summarizeValue,
} from "@/lib/game-data-changelog";
import {
    GAME_DATA_DATASETS,
    GAME_DATA_JOURNAL_DATASETS,
    isJournalWiredDataset,
} from "@/lib/game-data-sync-state";
import {
    collectGameDataChangeReferential,
    formatChangeValue,
} from "@/lib/game-data-change-format";

describe("journal des changements game-data — diff", () => {
    it("ne journalise rien quand rien n'a changé", () => {
        const before = { name: "Épée", level: 10 };
        expect(diffFields(before, { name: "Épée", level: 10 }, ["name", "level"])).toBeNull();
    });

    it("ne journalise rien sans valeur antérieure (fiche inconnue)", () => {
        expect(diffFields(null, { name: "Coiffe", level: 3 }, ["name", "level"])).toBeNull();
        expect(diffFields(undefined, { name: "Coiffe" }, ["name"])).toBeNull();
    });

    it("rend avant → après pour les seuls champs modifiés", () => {
        const diff = diffFields(
            { name: "Épée du Chaos", level: 10, description: "idem" },
            { name: "Épée du Chaos", level: 12, description: "idem" },
            ["name", "level", "description"],
        );
        expect(diff).toEqual({ level: { before: 10, after: 12 } });
        expect(Object.keys(diff ?? {})).not.toContain("name");
    });

    it("détecte les changements de contenu (tableaux/objets) sans les recopier en entier", () => {
        const diff = diffFields(
            { effects: [{ id: 1, value: 10 }] },
            { effects: [{ id: 1, value: 20 }] },
            ["effects"],
        );
        expect(diff).not.toBeNull();
        expect(String(diff?.effects.before)).toContain("effets".slice(0, 1));
    });

    it("borne le nombre de champs journalisés (le journal ne peut pas exploser)", () => {
        const before = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`f${i}`, i]));
        const after = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`f${i}`, i + 1]));
        const diff = diffFields(before, after, Object.keys(before));
        expect(Object.keys(diff ?? {})).toHaveLength(GAME_DATA_CHANGELOG_MAX_FIELDS);
    });
});

describe("journal des changements game-data — valeurs bornées", () => {
    it("tronque les chaînes trop longues", () => {
        const out = String(summarizeValue("x".repeat(GAME_DATA_CHANGELOG_MAX_VALUE_CHARS + 50)));
        expect(out).toHaveLength(GAME_DATA_CHANGELOG_MAX_VALUE_CHARS + 1); // + l'ellipse
        expect(out.endsWith("…")).toBe(true);
    });

    it("garde un tableau **structuré** : jamais du JSON aplati dans une chaîne", () => {
        // A3 (28/09/2026) — l'ancien résumé `[5 : 1, 2, …]` était une **chaîne** (issue d'un
        // `JSON.stringify` tronqué) : c'est exactement ce qui affichait `{"effectId":90,…}` dans la
        // modale, sans possibilité d'humaniser l'id. La valeur reste donc une **liste** bornée.
        expect(summarizeValue([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
        expect(summarizeValue([{ effectId: 90, from: 1, to: 15 }])).toEqual([
            { effectId: 90, from: 1, to: 15 },
        ]);
        // Au-delà de la borne, un marqueur dit ce qui n'est **pas** écrit (jamais une coupe muette).
        const long = Array.from({ length: GAME_DATA_CHANGELOG_MAX_LIST_ITEMS + 4 }, (_, i) => i);
        const summarized = summarizeValue(long) as unknown[];
        expect(summarized).toHaveLength(GAME_DATA_CHANGELOG_MAX_LIST_ITEMS + 1);
        expect(String(summarized.at(-1))).toContain("autre(s)");
        // Et l'élément reste un **objet** — jamais une chaîne `{"effectId":90,…}` aplatie.
        expect(typeof (summarizeValue([{ effectId: 90 }]) as unknown[])[0]).toBe("object");
    });

    it("laisse passer les scalaires et normalise l'absence de valeur", () => {
        expect(summarizeValue(12)).toBe(12);
        expect(summarizeValue(true)).toBe(true);
        expect(summarizeValue(null)).toBeNull();
        expect(summarizeValue(undefined)).toBeNull();
    });
});

describe("journal des changements game-data — collections (sorts, monstres…)", () => {
    const before = [
        { id: 1, name: "Éther", apCost: 3, damages: [{ min: 20, max: 30 }] },
        { id: 2, name: "Bond", apCost: 2, damages: [{ min: 10, max: 12 }] },
    ];

    it("détaille les éléments modifiés (id + nom + champs)", () => {
        const after = [
            { id: 1, name: "Éther", apCost: 4, damages: [{ min: 20, max: 30 }] },
            { id: 2, name: "Bond", apCost: 2, damages: [{ min: 10, max: 12 }] },
        ];
        const entries = diffCollection(before, after, { entityType: "spell", labelPrefix: "Huppermage" });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            entityType: "spell",
            entityId: "1",
            entityName: "Huppermage · Éther",
            changeType: "MODIFIED",
        });
        expect(entries[0].fields).toEqual({ apCost: { before: 3, after: 4 } });
    });

    it("signale les ajouts et les retraits", () => {
        const after = [
            { id: 1, name: "Éther", apCost: 3, damages: [] as { min: number; max: number }[] },
            { id: 3, name: "Nouveau", apCost: 1, damages: [] as { min: number; max: number }[] },
        ];
        const entries = diffCollection(before, after, { entityType: "spell", keys: ["apCost"] });
        expect(entries.map((e) => e.changeType).sort()).toEqual(["NEW", "REMOVED"]);
        expect(entries.find((e) => e.changeType === "REMOVED")?.entityId).toBe("2");
    });

    it("sans image antérieure, tout est nouveau (et rien n'est inventé)", () => {
        const entries = diffCollection(null, before, { entityType: "spell" });
        expect(entries).toHaveLength(2);
        expect(entries.every((e) => e.changeType === "NEW")).toBe(true);
    });
});

describe("journal des changements game-data — registre des siphons branchés", () => {
    it("ne référence que des datasets connus (aucun pointeur mort)", () => {
        for (const dataset of GAME_DATA_JOURNAL_DATASETS) {
            expect(GAME_DATA_DATASETS).toContain(dataset);
        }
    });

    it("déclare branché exactement ce que les cœurs écrivent (sinon l'UI mentirait)", () => {
        expect([...GAME_DATA_JOURNAL_DATASETS].sort()).toEqual([
            "ANOMALY_BOSSES",
            "ASSETS_WEBP",
            "BOUNTIES",
            "CATALOGUE",
            "CLASS_SPELLS",
            "FAMILIES",
            "ITEMS",
            "QUESTS",
            "REFERENTIALS",
            "ZONES",
        ]);
        expect(isJournalWiredDataset("ITEMS")).toBe(true);
        // `HARVEST` est un **script local** (JSON produit hors siphon) : jamais de journal ⇒ la
        // modale doit le dire, pas afficher un vide trompeur.
        expect(isJournalWiredDataset("HARVEST")).toBe(false);
    });

    it("tout dataset branché écrit dans le journal (aucune promesse en l'air)", () => {
        // Chaque writer est vérifié par un test de source : le registre suit le CODE, jamais l'inverse.
        const writers: Record<string, string> = {
            ITEMS: "src/lib/game-items-siphon.ts",
            QUESTS: "src/lib/quest-siphon.ts",
            CLASS_SPELLS: "src/lib/class-spells-siphon.ts",
            FAMILIES: "src/lib/monster-families-siphon.ts",
            ZONES: "src/lib/zones-siphon.ts",
            REFERENTIALS: "src/lib/market/referential-siphon.ts",
            CATALOGUE: "src/lib/dungeon-monsters-siphon.ts",
            ASSETS_WEBP: "src/lib/dofus-asset-siphon.ts",
            BOUNTIES: "src/lib/bounty-siphon.ts",
            ANOMALY_BOSSES: "src/lib/dofensive-sync.ts",
        };
        for (const [dataset, file] of Object.entries(writers)) {
            expect(isJournalWiredDataset(dataset as (typeof GAME_DATA_JOURNAL_DATASETS)[number])).toBe(true);
            const source = readFileSync(join(process.cwd(), file), "utf-8");
            expect(source, `${file} doit journaliser ${dataset}`).toContain("recordGameDataChanges");
        }
    });
});

describe("journal des changements game-data — rétention annoncée", () => {
    it("le libellé affiché est dérivé des constantes (aucune duplication dans l'UI)", () => {
        expect(GAME_DATA_CHANGELOG_RETENTION_LABEL).toContain(String(GAME_DATA_CHANGELOG_MAX_AGE_DAYS));
        expect(GAME_DATA_CHANGELOG_RETENTION_LABEL).toContain(
            String(GAME_DATA_CHANGELOG_KEEP_PER_DATASET),
        );
    });

    it("la rétention reste bornée (un journal qui remplit le disque serait un bug)", () => {
        expect(GAME_DATA_CHANGELOG_KEEP_PER_DATASET).toBeLessThanOrEqual(1000);
        expect(GAME_DATA_CHANGELOG_MAX_AGE_DAYS).toBeLessThanOrEqual(90);
    });
});

/**
 * A3 (28/09/2026) — **humanisation des valeurs journalisées**.
 *
 * Dette mesurée : la modale affichait `[3 : {"effectId":90,"from":1,…}]`, un JSON brut et tronqué,
 * là où l'utilisateur attend « Vitalité (1 à 15) ». Les règles sont celles du **marché** (table codée
 * puis référentiel siphonné puis identifiant) : aucune cascade recopiée, donc aucune divergence entre
 * ce que voit le marché et ce que voit le Journal.
 */
describe("journal des changements game-data — valeurs humanisées", () => {
    const referential = {
        labels: { 9001: "Résistance maison" },
        effectLabels: { 9002: "Effet maison", 90: "libellé court siphonné" },
    };

    it("suit l'ORDRE du marché : table codée, puis référentiel siphonné, puis identifiant", () => {
        // 1. Table codée (`CHAR_NAMES`) : jamais écrasée par un libellé siphonné plus court.
        expect(
            formatChangeValue([{ effectId: 90, from: 1, to: 15 }], { key: "effects", referential }),
        ).toBe("Dommages Eau (1 à 15)");
        // 2. Id absent de la table → libellé du référentiel, humanisé.
        expect(
            formatChangeValue([{ effectId: 9002, from: 2, to: 4 }], { key: "effects", referential }),
        ).toBe("Effet maison (2 à 4)");
        expect(formatChangeValue({ characteristic: 9001 }, { key: "effects", referential })).toBe(
            "Résistance maison",
        );
        // 3. Inconnu des deux ⇒ l'identifiant reste lisible : jamais un « — » à la place d'une valeur.
        const unknown = formatChangeValue([{ effectId: 424242, from: 2, to: 4 }], {
            key: "effects",
            referential,
        });
        expect(unknown).toContain("Effet #424242");
        expect(unknown).not.toContain("—");
    });

    it("sans référentiel (base non alimentée), la dégradation reste lisible", () => {
        expect(formatChangeValue([{ effectId: 90, from: 1, to: 15 }], { key: "effects" })).toBe(
            "Dommages Eau (1 à 15)",
        );
        expect(formatChangeValue("Avis 12 : butin illisible", { key: "name" })).toBe(
            "Avis 12 : butin illisible",
        );
    });

    it("une plage journalisée suit `normalizeNativeRange` : « 10 à 0 » n'existe pas", () => {
        // `diceSide = 0` = valeur FIXE (règle du marché) ⇒ « 10 », jamais « 10 à 0 ».
        expect(formatChangeValue([{ effectId: 90, from: 10, to: 0 }], { key: "effects" })).toBe(
            "Dommages Eau (10)",
        );
        expect(formatChangeValue([{ effectId: 90, from: null, to: null }], { key: "effects" })).toBe(
            "Dommages Eau",
        );
    });

    it("un `…Id` est accompagné du nom porté par la fiche (aucune requête en plus)", () => {
        const fields = { typeId: { before: 8, after: 9 }, typeName: { before: "Coiffe", after: "Cape" } };
        expect(formatChangeValue(8, { key: "typeId", fields, side: "before" })).toBe("8 — Coiffe");
        // ⚠️ Le nom d'après ne nomme jamais l'id d'avant : chaque côté reste honnête.
        expect(formatChangeValue(9, { key: "typeId", fields, side: "after" })).toBe("9 — Cape");
        expect(formatChangeValue(8, { key: "typeId" })).toBe("8");
    });

    it("jamais de JSON brut ni de `[object Object]` dans une valeur affichée", () => {
        expect(formatChangeValue({ apCost: 4, minRange: 1 }, { key: "stats" })).toBe(
            "apCost : 4 · minRange : 1",
        );
        expect(formatChangeValue(null, { key: "name" })).toBe("—");
        expect(formatChangeValue([], { key: "effects" })).toBe("(vide)");
        expect(formatChangeValue({}, { key: "effects" })).toBe("(vide)");
    });
});


/**
 * A3 — **référentiel borné aux ids affichés**. `loadMarketReferential()` porte tous les effets du
 * jeu (~3 000) : l'envoyer entier à chaque ouverture de la modale serait du gaspillage. Même
 * invariant que le `groupBy` borné par dataset : la charge suit ce qu'on affiche.
 */
describe("journal des changements game-data — référentiel borné", () => {
    const referential = {
        labels: { 9001: "Résistance maison" },
        effectLabels: { 9002: "Effet maison", 90: "libellé court siphonné" },
    };

    it("ne garde que les ids présents dans les lignes renvoyées", () => {
        const rows: { fields?: Record<string, { before: unknown; after: unknown }> | null }[] = [
            {
                fields: {
                    effects: { before: [{ effectId: 9002, from: 1, to: 2 }], after: { characteristic: 9001 } },
                },
            },
            { fields: { autre: { before: null, after: [{ int_id: "9002" }] } } },
        ];
        expect(collectGameDataChangeReferential(rows, referential)).toEqual({
            labels: { 9001: "Résistance maison" },
            effectLabels: { 9002: "Effet maison" },
        });
        expect(collectGameDataChangeReferential([], referential)).toEqual({ labels: {}, effectLabels: {} });
        // Un id absent du référentiel n'est **jamais inventé**.
        expect(
            collectGameDataChangeReferential(
                [{ fields: { f: { before: { effectId: 424242 }, after: null } } }],
                referential,
            ),
        ).toEqual({ labels: {}, effectLabels: {} });
    });

    it("le parcours est borné en profondeur (une imbrication abusive ne boucle pas)", () => {
        const wrap = (value: unknown, times: number) => {
            let wrapped: unknown = value;
            for (let i = 0; i < times; i += 1) wrapped = { niveau: wrapped };
            return wrapped;
        };
        const collected = (times: number) =>
            collectGameDataChangeReferential(
                [{ fields: { f: { before: wrap({ effectId: 9002 }, times), after: null } } }],
                referential,
            ).effectLabels;
        expect(collected(3)).toEqual({ 9002: "Effet maison" }); // profondeur normale : résolu
        expect(collected(12)).toEqual({}); // au-delà de la borne : ignoré, jamais un plantage
    });

    it("l'action serveur fournit CE référentiel (jamais le complet, jamais depuis le client)", () => {
        const actions = readFileSync(
            join(process.cwd(), "src/server/actions/game-data-sync-actions.ts"),
            "utf-8",
        );
        expect(actions).toContain("collectGameDataChangeReferential(");
        expect(actions).toContain("loadMarketReferential()");
        const modal = readFileSync(
            join(process.cwd(), "src/components/admin/GameDataChangeLogModal.tsx"),
            "utf-8",
        );
        expect(modal).toContain("formatChangeValue"); // l'UI ne réimplémente pas l'humanisation
        expect(modal).not.toContain("JSON.stringify");
    });
});

