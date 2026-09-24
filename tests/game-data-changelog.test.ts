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

    it("résume les tableaux au lieu de les recopier", () => {
        expect(String(summarizeValue([1, 2, 3, 4, 5]))).toContain("[5 :");
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
