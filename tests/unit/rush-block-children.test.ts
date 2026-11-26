import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import {
    RUSH_CHILD_POSITION_END,
    isRushChildType,
    mergeRushBlockItems,
    normalizeRushChildPosition,
    removeRushChild,
    rushChildPositionAfter,
    upsertRushChild,
} from "@/lib/rush-block-children";

/**
 * Sous-blocs d'un bloc du Rush (Tips / Obtention Dofus / Combat).
 *
 * Mesure du 25/11/2026 : ces types étaient forcés en chapitre 0 et ne pouvaient pas
 * être posés **après une quête** d'un bloc. La règle pure intercale `position` avec
 * `GuideSequence.order` ; `9999` = fin du bloc.
 */

const seq = (id: string, order: number) => ({ id, order, subGuideRef: id, subGuideName: id, isOptional: false });
const child = (id: string, position: number, order = 0) => ({
    id,
    type: "INFO" as const,
    title: id,
    position,
    order,
});

describe("sous-blocs — ordre d'affichage", () => {
    it("pose un sous-bloc juste après la quête visée", () => {
        const items = mergeRushBlockItems([seq("q1", 0), seq("q2", 1)], [child("tips", rushChildPositionAfter(0))]);

        expect(items.map((item) => (item.kind === "sequence" ? item.sequence.id : item.child.id))).toEqual([
            "q1",
            "tips",
            "q2",
        ]);
    });

    it("pose un sous-bloc à la fin du bloc", () => {
        const items = mergeRushBlockItems([seq("q1", 0), seq("q2", 1)], [child("dofus", RUSH_CHILD_POSITION_END)]);

        expect(items.map((item) => (item.kind === "sequence" ? item.sequence.id : item.child.id))).toEqual([
            "q1",
            "q2",
            "dofus",
        ]);
    });

    it("à position égale, la quête passe avant le sous-bloc, puis l'ordre départage", () => {
        const items = mergeRushBlockItems(
            [seq("q1", 1)],
            [child("b", 1, 2), child("a", 1, 1)]
        );

        expect(items.map((item) => (item.kind === "sequence" ? item.sequence.id : item.child.id))).toEqual([
            "q1",
            "a",
            "b",
        ]);
    });

    it("une position invalide tombe en fin de bloc", () => {
        expect(normalizeRushChildPosition(Number.NaN)).toBe(RUSH_CHILD_POSITION_END);
        expect(normalizeRushChildPosition(-1)).toBe(RUSH_CHILD_POSITION_END);
        expect(normalizeRushChildPosition(2.5)).toBe(2.5);
        expect(normalizeRushChildPosition(50_000)).toBe(RUSH_CHILD_POSITION_END);
    });

    it("n'accepte que les types de sous-bloc prévus", () => {
        expect(isRushChildType("INFO")).toBe(true);
        expect(isRushChildType("DOFUS_OBTAINED")).toBe(true);
        expect(isRushChildType("QUETE_SERIE")).toBe(false);
        expect(isRushChildType("SUCCES")).toBe(false);
    });

    it("ne mute pas les entrées", () => {
        const sequences = [seq("q1", 0)];
        const children = [child("tips", 0.5)];
        const before = JSON.stringify({ sequences, children });

        mergeRushBlockItems(sequences, children);

        expect(JSON.stringify({ sequences, children })).toBe(before);
    });
});

describe("sous-blocs — sauvegarde immédiate", () => {
    it("ajoute un sous-bloc sans muter la liste", () => {
        const before = [child("tips", 0.5)];
        const next = upsertRushChild(before, child("dofus", 1.5));

        expect(next.map((item) => item.id)).toEqual(["tips", "dofus"]);
        expect(before.map((item) => item.id)).toEqual(["tips"]);
    });

    it("remplace le sous-bloc au même id (édition) sans muter la liste", () => {
        const before = [child("tips", 0.5), child("dofus", 1.5)];
        const edited = { ...child("tips", 2.5), title: "Tips déplacé" };
        const next = upsertRushChild(before, edited);

        expect(next.map((item) => [item.id, item.position, item.title])).toEqual([
            ["tips", 2.5, "Tips déplacé"],
            ["dofus", 1.5, "dofus"],
        ]);
        expect(before[0].position).toBe(0.5);
    });

    it("retire un sous-bloc sans muter la liste", () => {
        const before = [child("tips", 0.5), child("dofus", 1.5)];
        const next = removeRushChild(before, "tips");

        expect(next.map((item) => item.id)).toEqual(["dofus"]);
        expect(before.map((item) => item.id)).toEqual(["tips", "dofus"]);
    });

    it("le studio remonte la liste et isole chaque bloc", () => {
        const studio = read("src/components/god/rush-editor/RushEditorStudio.tsx");
        const editor = read("src/components/god/rush-editor/RushBlockChildrenEditor.tsx");

        expect(studio).toContain("onChildrenChange={onChildrenChange}");
        expect(studio).toContain("key={milestone.id}");
        expect(editor).toContain("onChildrenChange?.(upsertRushChild(childBlocks, saved))");
        expect(editor).toContain("onChildrenChange?.(removeRushChild(childBlocks, id))");
    });
});

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

describe("sous-blocs — branchement", () => {
    it("la migration additive et le modèle existent", () => {
        const schema = read("prisma/schema.prisma");
        expect(schema).toContain("model GuideMilestoneChild");
        expect(schema).toContain("children        GuideMilestoneChild[]");
        expect(
            existsSync(path.join(ROOT, "prisma/migrations/20270208000000_add_guide_milestone_child/migration.sql"))
        ).toBe(true);
    });

    it("les trois surfaces rendent le composant partagé", () => {
        expect(read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx")).toContain("RushBlockChild");
        expect(read("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx")).toContain("RushBlockChild");
        expect(read("src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx")).toContain("RushBlockChild");
        expect(read("src/components/dofus-quests/rush/RushBlockChild.tsx")).toContain("RushInfoBanner");
        expect(read("src/components/dofus-quests/rush/RushBlockChild.tsx")).toContain("DofusObtainedBanner");
    });

    it("le studio God monte l'éditeur de sous-blocs", () => {
        expect(read("src/components/god/rush-editor/RushEditorStudio.tsx")).toContain("<RushBlockChildrenEditor");
        expect(read("src/components/god/rush-editor/RushBlockChildrenEditor.tsx")).toContain("createRushMilestoneChild");
    });
});
