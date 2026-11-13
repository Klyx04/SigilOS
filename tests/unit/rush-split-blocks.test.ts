/**
 * Gardes — split d'un bloc multi-quêtes (God Rush).
 *
 * 🎯 Mesure du 05/11/2026 : sur la bêta, « Alignement Brâkmarien — palier 20 » (20 quêtes),
 * « Ordres — Cœur Saignant » (5) et « Quêtes de classe » (19) sont **une seule séquence**.
 * La route ne peut pas filtrer une quête à l'intérieur, et « Déplacer vers » déplace le bloc.
 * Le split crée N séquences de 1 quête, à la même position, avec la route du bloc et les
 * données par quête — sans jamais recopier l'union des ressources du bloc.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildRushSplitPlan, inferAlignmentCamp } from "@/lib/rush-split";
import { RUSH_CLASS_QUESTS } from "@/lib/rush-class-quests";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";

const ACTIONS = readFileSync("src/server/actions/optimized-guide-actions.ts", "utf8");
const ADMIN = readFileSync("src/components/god/rush-editor/RushEditorStudio.tsx", "utf8");

function functionOf(source: string, name: string): string {
    const start = source.indexOf(`export async function ${name}(`);
    if (start < 0) return "";
    const next = source.indexOf("\nexport async function ", start + 10);
    return source.slice(start, next > start ? next : source.length);
}

const metaOf = (map: Record<number, { name?: string; classReq?: string; activityTags?: unknown[]; dungeonIds?: string[] }>) =>
    (qid: number) => map[qid];

describe("inferAlignmentCamp", () => {
    it("lit la cité dans le titre du bloc", () => {
        expect(inferAlignmentCamp("Alignement Bontarien — palier 20")).toBe("bontarien");
        expect(inferAlignmentCamp("Alignement Brâkmarien — palier 40")).toBe("brakmarien");
    });

    it("lit le tag `alignment_set` quand le titre ne dit rien", () => {
        expect(inferAlignmentCamp("Bloc neutre", null, [{ type: "alignment_set", camp: "bontarien" }])).toBe("bontarien");
    });

    it("ne devine rien sans indice", () => {
        expect(inferAlignmentCamp("Quêtes de classe", null, [])).toBeNull();
    });
});

describe("buildRushSplitPlan — une quête par ligne, sans perdre la route", () => {
    it("découpe un palier de cité en gardant la cité et l'ordre du bloc", () => {
        const drafts = buildRushSplitPlan(
            {
                id: "block",
                order: 5,
                subGuideName: "Alignement Brâkmarien — palier 20",
                questDbIds: [1, 2, 3],
                alignReq: null,
                tips: "Conseil du bloc",
                activityTags: [{ type: "item", name: "Union du bloc", id: "999" }],
                dungeonIds: ["dungeon-du-bloc"],
            },
            metaOf({
                1: { name: "Quête A", activityTags: [{ type: "item", name: "A", id: "1" }] },
                2: { name: "Quête B" },
            }),
        );

        expect(drafts).toHaveLength(3);
        expect(drafts.map((d) => d.order)).toEqual([5, 6, 7]);
        expect(drafts.map((d) => d.subGuideName)).toEqual(["Quête A", "Quête B", "Alignement Brâkmarien — palier 20 — 3"]);
        expect(drafts.every((d) => d.alignReq === "brakmarien")).toBe(true);
        // Le tip du bloc reste sur la première ; il n'est pas dupliqué.
        expect(drafts[0].tips).toBe("Conseil du bloc");
        expect(drafts[1].tips).toBeNull();
        // Les ressources/donjons par quête viennent du meta, jamais de l'union du bloc.
        expect(drafts[0].activityTags).toEqual([{ type: "item", name: "A", id: "1" }]);
        expect(drafts[1].activityTags).toEqual([]);
        expect(drafts.every((d) => d.dungeonIds.length === 0)).toBe(true);
    });

    it("déduit les 5 paliers d'un Ordre par position", () => {
        const drafts = buildRushSplitPlan(
            {
                id: "ordre",
                order: 0,
                subGuideName: "Ordres — Cœur Saignant",
                questDbIds: [11, 12, 13, 14, 15],
                alignReq: "brakmarien",
                alignOrderCode: "coeur_saignant",
            },
            metaOf({}),
        );

        expect(drafts.map((d) => d.alignOrderCode)).toEqual(Array(5).fill("coeur_saignant"));
        expect(drafts.map((d) => d.alignLevelReq)).toEqual([20, 40, 60, 80, 100]);
    });

    it("utilise la table des 19 classes, jamais le classReq erroné du bloc", () => {
        const drafts = buildRushSplitPlan(
            {
                id: "classes",
                order: 0,
                subGuideName: "Quêtes de classe",
                questDbIds: [1963, 1964],
                classReq: "cra",
            },
            (qid) => ({ name: `Classe ${qid}`, classReq: RUSH_CLASS_QUESTS[qid] }),
        );

        expect(drafts.map((d) => d.classReq)).toEqual(["feca", "osamodas"]);
    });

    it("ne fait rien pour une séquence à une seule quête", () => {
        expect(
            buildRushSplitPlan(
                { id: "simple", order: 0, subGuideName: "Une quête", questDbIds: [42] },
                metaOf({}),
            ),
        ).toEqual([]);
    });
});

describe("RUSH_CLASS_QUESTS — 19 classes, aucune devinée", () => {
    it("couvre les 19 classes avec des ids valides", () => {
        const entries = Object.entries(RUSH_CLASS_QUESTS);
        expect(entries).toHaveLength(19);
        const valid = new Set<string>(DOFUS_CLASSES.map((c) => c.id));
        for (const [qid, classId] of entries) {
            expect(Number(qid)).toBeGreaterThan(0);
            expect(valid.has(classId), `${qid} → ${classId} n'est pas une classe connue`).toBe(true);
        }
        expect(RUSH_CLASS_QUESTS[1963]).toBe("feca");
        expect(RUSH_CLASS_QUESTS[2470]).toBe("forgelance");
    });
});

describe("splitRushSequence — l'action écrit les N quêtes et reporte la progression", () => {
    const code = functionOf(ACTIONS, "splitRushSequence");

    it("existe, borne son id et passe par le rate limit", () => {
        expect(code).not.toBe("");
        expect(code).toContain("SplitRushSequenceSchema");
        expect(code).toContain('requireRushWriteAccess("rush-split-sequence"');
    });

    it("refuse une séquence à une seule quête et un bloc d'alignement sans cité", () => {
        expect(code).toContain("block.questDbIds.length <= 1");
        expect(code).toContain("Renseigne la cité du bloc");
    });

    it("ouvre les créneaux, crée les quêtes, reporte les coches et supprime le bloc", () => {
        expect(code).toContain("buildRushSplitPlan");
        expect(code).toContain("rushSplitMetaOf");
        expect(code).toContain("order: { increment: drafts.length - 1 }");
        expect(code).toContain("playerGuideProgress");
        expect(code).toContain("completedSteps: next");
        expect(code).toContain("guideSequence.delete");
    });
});

describe("studio — le bouton de scission est visible pour un bloc multi-quêtes", () => {
    it("appelle onSplit et n'apparaît que si la séquence porte plusieurs quêtes", () => {
        expect(ADMIN).toContain("onSplit(seq.id");
        expect(ADMIN).toContain("seq.questDbIds.length > 1");
        expect(ADMIN).toContain("Scinder en");
    });
});
