/**
 * Solveur Comte Harebourg — règles mesurées (guides + fiche boss interne).
 * Chaque cas verrouille une règle du combat : symétrie, glyphe, confusion,
 * strip pair/impair, zone létale d'échange, scoring d'invocation.
 */

import { describe, it, expect } from "vitest";
import {
    symmetricOf,
    glyphDangerCells,
    applyConfusion,
    meleeConfusionDrift,
    planVulnerabilityStrip,
    scoreSummonPlacement,
    manhattan,
    sameCell,
    type HarebourgEntity,
} from "@/lib/harebourg-solver";

const ally = (id: string, x: number, y: number): HarebourgEntity => ({ id, cell: { x, y }, kind: "ally" });
const summon = (id: string, x: number, y: number): HarebourgEntity => ({ id, cell: { x, y }, kind: "summon" });
const enemy = (id: string, x: number, y: number): HarebourgEntity => ({ id, cell: { x, y }, kind: "enemy" });

describe("symmetricOf — rotation 180°", () => {
    it("renvoie le point opposé par rapport au centre", () => {
        expect(symmetricOf({ x: 5, y: 0 }, { x: 0, y: 0 })).toEqual({ x: -5, y: 0 });
        expect(symmetricOf({ x: 2, y: 3 }, { x: 2, y: 3 })).toEqual({ x: 2, y: 3 });
    });
});

describe("glyphDangerCells — croix Mi-temps taille 3, centre inclus", () => {
    it("couvre 13 cases en croix avec le centre", () => {
        const cells = glyphDangerCells({ x: 0, y: 0 });
        expect(cells).toHaveLength(13);
        expect(cells.some((c) => sameCell(c, { x: 0, y: 0 }))).toBe(true);
        expect(cells.some((c) => sameCell(c, { x: 3, y: 0 }))).toBe(true);
        expect(cells.some((c) => sameCell(c, { x: 0, y: -3 }))).toBe(true);
        // Pas de diagonales : ce n'est pas un diamant.
        expect(cells.some((c) => sameCell(c, { x: 2, y: 2 }))).toBe(false);
    });
});

describe("applyConfusion — redirection des sorts", () => {
    it("tourne à 180° quel que soit le sens", () => {
        expect(applyConfusion({ x: 1, y: 0 }, { x: 0, y: 0 }, 180, "clockwise")).toEqual({ x: -1, y: 0 });
        expect(applyConfusion({ x: 1, y: 0 }, { x: 0, y: 0 }, 180, "counterclockwise")).toEqual({ x: -1, y: 0 });
    });

    it("tourne à 90° selon le sens (repère écran, y vers le bas)", () => {
        expect(applyConfusion({ x: 1, y: 0 }, { x: 0, y: 0 }, 90, "clockwise")).toEqual({ x: 0, y: 1 });
        expect(applyConfusion({ x: 1, y: 0 }, { x: 0, y: 0 }, 90, "counterclockwise")).toEqual({ x: 0, y: -1 });
    });

    it("dérive de +90° antihoraire par ligne au corps-à-corps", () => {
        expect(meleeConfusionDrift(0)).toBe(0);
        expect(meleeConfusionDrift(1)).toBe(90);
        expect(meleeConfusionDrift(2)).toBe(180);
        expect(meleeConfusionDrift(4)).toBe(0);
    });
});

describe("planVulnerabilityStrip — frapper le Comte", () => {
    const boss = { x: 0, y: 0 };
    const attacker = { x: 0, y: -5 };

    it("tour impair : l'attaquant tourne, pas de vulnérabilité", () => {
        const plan = planVulnerabilityStrip({
            bossCell: boss,
            attackerCell: attacker,
            turnNumber: 3,
            entities: [],
            blockedCells: [],
        });
        expect(plan.isEvenTurn).toBe(false);
        expect(plan.stripsInvulnerability).toBe(false);
        // L'attaquant atterrit symétriquement par rapport au Comte.
        expect(plan.landing).toEqual({ x: 0, y: -10 });
    });

    it("tour pair sans entité à l'arrivée : déplacement sans échange", () => {
        const plan = planVulnerabilityStrip({
            bossCell: boss,
            attackerCell: attacker,
            turnNumber: 2,
            entities: [],
            blockedCells: [],
        });
        expect(plan.landing).toEqual({ x: 0, y: 5 });
        expect(plan.stripsInvulnerability).toBe(false);
    });

    it("tour pair sur un allié : vulnérabilité + bonus +100", () => {
        const plan = planVulnerabilityStrip({
            bossCell: boss,
            attackerCell: attacker,
            turnNumber: 4,
            entities: [ally("panda", 0, 5)],
            blockedCells: [],
        });
        expect(plan.stripsInvulnerability).toBe(true);
        expect(plan.swapEntity?.id).toBe("panda");
        expect(plan.allyDamageBonus).toBe(true);
        expect(plan.killZoneAllies).toEqual([]);
        expect(plan.teamWipeRisk).toBe(false);
    });

    it("tour pair sur une invocation isolée : vulnérabilité sans perte", () => {
        const plan = planVulnerabilityStrip({
            bossCell: boss,
            attackerCell: attacker,
            turnNumber: 2,
            entities: [summon("arakne", 0, 5), ally("loin", 10, 10)],
            blockedCells: [],
        });
        expect(plan.stripsInvulnerability).toBe(true);
        expect(plan.allyDamageBonus).toBe(false);
        expect(plan.killZoneAllies).toEqual([]);
    });

    it("tour pair sur une invocation entourée : la zone létale est nommée", () => {
        const plan = planVulnerabilityStrip({
            bossCell: boss,
            attackerCell: attacker,
            turnNumber: 2,
            entities: [summon("arakne", 0, 5), ally("iop", 1, 0), ally("loin", 10, 10)],
            blockedCells: [],
        });
        expect(plan.stripsInvulnerability).toBe(true);
        expect(plan.killZoneAllies.map((e) => e.id)).toEqual(["iop"]);
    });

    it("arrivée impossible : toute l'équipe meurt", () => {
        const plan = planVulnerabilityStrip({
            bossCell: boss,
            attackerCell: attacker,
            turnNumber: 2,
            entities: [ally("panda", 0, 5)],
            blockedCells: [{ x: 0, y: 5 }],
        });
        expect(plan.teamWipeRisk).toBe(true);
        expect(plan.stripsInvulnerability).toBe(false);
    });

    it("tour pair sur un ennemi : vulnérabilité sans bonus", () => {
        const plan = planVulnerabilityStrip({
            bossCell: boss,
            attackerCell: attacker,
            turnNumber: 6,
            entities: [enemy("cycloide", 0, 5)],
            blockedCells: [],
        });
        expect(plan.stripsInvulnerability).toBe(true);
        expect(plan.allyDamageBonus).toBe(false);
    });
});

describe("scoreSummonPlacement — où poser l'invocation", () => {
    const boss = { x: 0, y: 0 };

    it("refuse une case occupée", () => {
        const res = scoreSummonPlacement({
            candidate: { x: 2, y: 0 },
            bossCell: boss,
            turnNumber: 2,
            allies: [],
            occupiedCells: [{ x: 2, y: 0 }],
            purpose: "strip",
        });
        expect(res.score).toBe(0);
        expect(res.safe).toBe(false);
    });

    it("pénalise le glyphe et valorise l'échange pair isolé", () => {
        const inGlyph = scoreSummonPlacement({
            candidate: { x: 1, y: 0 },
            bossCell: boss,
            turnNumber: 2,
            allies: [],
            occupiedCells: [],
            purpose: "strip",
        });
        expect(inGlyph.notes.some((n) => n.includes("glyphe"))).toBe(true);

        const clean = scoreSummonPlacement({
            candidate: { x: 5, y: 5 },
            bossCell: boss,
            turnNumber: 2,
            allies: [],
            occupiedCells: [],
            purpose: "strip",
        });
        expect(clean.safe).toBe(true);
        expect(clean.score).toBeGreaterThan(inGlyph.score);
    });

    it("déconseille le strip en tour impair", () => {
        const res = scoreSummonPlacement({
            candidate: { x: 5, y: 5 },
            bossCell: boss,
            turnNumber: 3,
            allies: [],
            occupiedCells: [],
            purpose: "strip",
        });
        expect(res.notes.some((n) => n.includes("impair"))).toBe(true);
    });

    it("dose l'appât selon la distance (IA agressive, 5 PM)", () => {
        const near = scoreSummonPlacement({
            candidate: { x: 4, y: 0 },
            bossCell: boss,
            turnNumber: 1,
            allies: [],
            occupiedCells: [],
            purpose: "bait",
        });
        const far = scoreSummonPlacement({
            candidate: { x: 10, y: 0 },
            bossCell: boss,
            turnNumber: 1,
            allies: [],
            occupiedCells: [],
            purpose: "bait",
        });
        expect(near.score).toBeGreaterThan(far.score);
        expect(manhattan({ x: 4, y: 0 }, boss)).toBe(4);
    });
});
