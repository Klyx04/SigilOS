/**
 * Gardes — déplacement d'une quête entre blocs (studio God Rush).
 *
 * 🎯 Bug mesuré le 05/11/2026 : le bouton « Déplacer vers » réutilisait la
 * sauvegarde complète avec des champs partiels. Il ne changeait pas
 * `milestoneId` et remettait `alignOrderCode`, `alignLevelReq`, `classReq`,
 * `isSuccess`, `icon` et `metamobMonsterId` à null/false (perte de route).
 *
 * Ce verrou exige une action dédiée qui n'écrit **que** le bloc et l'ordre,
 * et un studio qui appelle cette action — pas `upsertRushSequence`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { nextSequenceOrder } from "@/lib/rush-move";

const ACTIONS = readFileSync("src/server/actions/optimized-guide-actions.ts", "utf8");
const ADMIN = readFileSync("src/components/god/rush-editor/RushEditorStudio.tsx", "utf8");

function functionOf(source: string, name: string): string {
    const start = source.indexOf(`export async function ${name}(`);
    if (start < 0) return "";
    const next = source.indexOf("\nexport async function ", start + 10);
    return source.slice(start, next > start ? next : source.length);
}

describe("nextSequenceOrder", () => {
    it("place la première quête d'un bloc à l'ordre 0", () => {
        expect(nextSequenceOrder([])).toBe(0);
    });

    it("ajoute après le plus grand ordre, même avec des trous", () => {
        expect(nextSequenceOrder([0, 2, 5])).toBe(6);
    });

    it("ignore les valeurs non finies", () => {
        expect(nextSequenceOrder([0, Number.NaN, 3])).toBe(4);
    });
});

describe("moveRushSequence — l'action ne touche que le bloc et l'ordre", () => {
    const code = functionOf(ACTIONS, "moveRushSequence");

    it("existe, borne ses deux ids et passe par le rate limit d'écriture", () => {
        expect(code).not.toBe("");
        expect(code).toContain("MoveRushSequenceSchema");
        expect(code).toContain('requireRushWriteAccess("rush-move-sequence"');
    });

    it("vérifie que le bloc cible appartient au même guide Rush", () => {
        expect(code).toContain("guideId: source.milestone.guideId");
        expect(code).toContain('source.milestone.guide.slug !== "rush-sylvestre"');
    });

    it("refuse un séparateur et un bloc Conseil / Tips", () => {
        expect(code).toContain('target.type === "SEPARATEUR"');
        expect(code).toContain('target.type === "INFO"');
    });

    it("met à jour `milestoneId` et `order`, jamais les champs de route", () => {
        const update = code.slice(code.indexOf("guideSequence.update"), code.indexOf("return { moved: true"));
        expect(update).toContain("milestoneId: target.id");
        expect(update).toContain("order: nextSequenceOrder");
        for (const field of [
            "alignReq",
            "alignOrderCode",
            "alignLevelReq",
            "classReq",
            "tips",
            "activityTags",
            "isSuccess",
            "icon",
            "metamobMonsterId",
        ]) {
            expect(update, `${field} ne doit pas être réécrit par un déplacement`).not.toContain(field);
        }
    });
});

describe("studio — le bouton appelle l'action dédiée", () => {
    it("le contrôle « Déplacer vers » appelle onMove, plus onSave avec des champs partiels", () => {
        expect(ADMIN).toContain("onMove(seq.id");
        expect(ADMIN).not.toContain("onSave({ subGuideRef: name.trim(), activityTags }, targetId)");
    });

    it("le formulaire reçoit la liste complète des blocs (sinon le contrôle est masqué)", () => {
        expect(ADMIN).toContain("milestones={allMilestones}");
        expect(ADMIN).toContain("allMilestones={localMilestones}");
    });

    it("la sauvegarde ne porte plus de bloc cible (le déplacement a son action)", () => {
        expect(ADMIN).toContain("onSave: (data: any) => void");
        expect(ADMIN).not.toContain("onSave: (data: any, targetMilestoneId?: string) => void");
    });
});
