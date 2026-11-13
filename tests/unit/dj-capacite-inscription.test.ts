/**
 * Capacité d'inscription d'un post Donjons & Quêtes — régression du 30/10/2026.
 *
 * Constat beta : depuis les boutons Discord (embed **donjon** comme **quête**), des joueurs
 * entraient dans un groupe déjà complet au lieu de partir en file d'attente ; le ratio
 * affiché montait à **5/4**, 6/4 sur un groupe de 4.
 *
 * Cause mesurée : `internalJoinDjPost` comptait `p.status === "ACCEPTED"` sur une relation
 * Prisma projetée `{ id, dungeonIndex }` — **sans `status`**. `undefined === "ACCEPTED"` est
 * toujours faux ⇒ le compteur restait à 1 (créateur seul) ⇒ groupe jamais complet, post
 * jamais passé `FULL`. Le chemin dashboard (`joinDjPost`), lui, projetait `status` : il
 * n'était pas touché — d'où l'asymétrie signalée.
 *
 * Verrouillé ici : ① le comportement de la règle partagée `resolveDjJoinCapacity`
 * (même comptage que l'affichage : créateur inclus, `PENDING` exclu, capacité par donjon),
 * ② la projection Discord et la promotion depuis la file (gardes de câblage).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { resolveDjJoinCapacity } from "@/lib/dungeon-finder-utils";

const ACTIONS = "src/server/actions/dungeon-finder-actions.ts";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ACTIONS_CODE = codeOnly(readFileSync(ACTIONS, "utf8"));

const ACCEPTED = "ACCEPTED";
const PENDING = "PENDING";

/** Post simple : `accepted` inscrits validés + `pending` en file, sans donjon (créateur à part). */
function simplePost(maxMembers: number, accepted: number, pending = 0) {
    return {
        maxMembers,
        dungeonsJson: null,
        participants: [
            ...Array.from({ length: accepted }, () => ({ status: ACCEPTED, dungeonIndex: null })),
            ...Array.from({ length: pending }, () => ({ status: PENDING, dungeonIndex: null })),
        ],
    };
}

/** Post multi : donjon 0 = 2 places, donjon 1 = 4 places. */
function multiPost(participants: { status: string; dungeonIndex: number | null }[]) {
    return {
        maxMembers: 4,
        dungeonsJson: [
            { dungeonId: "a", name: "A", bossName: "Boss A", level: 1, imageUrl: null, maxMembers: 2 },
            { dungeonId: "b", name: "B", bossName: "Boss B", level: 1, imageUrl: null, maxMembers: 4 },
        ],
        participants,
    };
}

describe("capacité d'inscription DJ — la place se décide comme elle s'affiche", () => {
    it("un groupe de 4 complet (créateur + 3 inscrits) met le suivant en file d'attente", () => {
        expect(resolveDjJoinCapacity(simplePost(4, 3), null)).toMatchObject({
            full: true,
            acceptedCount: 4,
            maxMembers: 4,
            groupIndex: -1,
        });
    });

    it("une place reste ouverte tant que les inscrits validés ne remplissent pas le groupe", () => {
        const capacity = resolveDjJoinCapacity(simplePost(4, 2), null);
        expect(capacity.full).toBe(false);
        expect(capacity.acceptedCount).toBe(3);
    });

    it("la file d'attente ne consomme aucune place", () => {
        const capacity = resolveDjJoinCapacity(simplePost(4, 1, 5), null);
        expect(capacity.full).toBe(false);
        expect(capacity.acceptedCount).toBe(2);
    });

    it("le créateur occupe une place : un groupe de 1 est plein dès la création", () => {
        expect(resolveDjJoinCapacity(simplePost(1, 0), null)).toMatchObject({
            full: true,
            acceptedCount: 1,
            maxMembers: 1,
        });
    });

    it("multi-donjons : chaque groupe garde sa propre taille", () => {
        const post = multiPost([{ status: ACCEPTED, dungeonIndex: 0 }]);
        expect(resolveDjJoinCapacity(post, 0)).toMatchObject({
            full: true,
            acceptedCount: 2,
            maxMembers: 2,
            groupIndex: 0,
        });
        expect(resolveDjJoinCapacity(post, 1)).toMatchObject({
            full: false,
            acceptedCount: 1,
            maxMembers: 4,
            groupIndex: 1,
        });
    });

    it("un inscrit sans donjon (hérité) compte dans chaque groupe", () => {
        const post = multiPost([{ status: ACCEPTED, dungeonIndex: null }]);
        expect(resolveDjJoinCapacity(post, 0).acceptedCount).toBe(2);
        expect(resolveDjJoinCapacity(post, 1).acceptedCount).toBe(2);
    });

    it("multi sans donjon visé : il faut une place dans TOUS les groupes (fail-closed)", () => {
        // Donjon 0 plein, donjon 1 libre : un inscrit « global » compterait dans les deux,
        // il part donc en file d'attente.
        const post = multiPost([{ status: ACCEPTED, dungeonIndex: 0 }]);
        const capacity = resolveDjJoinCapacity(post, null);
        expect(capacity.full).toBe(true);
        expect(capacity.maxMembers).toBe(2);
    });
});

describe("câblage Discord — la capacité lit une projection complète", () => {
    it("la relation `participants` de l'inscription Discord projette `status`", () => {
        expect(ACTIONS_CODE).toContain("participants: { select: { id: true, status: true, dungeonIndex: true } }");
    });

    it("plus aucune projection amputée de `status` (cause du 5/4)", () => {
        expect(ACTIONS_CODE).not.toContain("select: { id: true, dungeonIndex: true }");
    });

    it("les trois chemins (dashboard, Discord, acceptation) passent par la règle partagée", () => {
        const calls = ACTIONS_CODE.match(/resolveDjJoinCapacity\(/g) ?? [];
        expect(calls.length).toBeGreaterThanOrEqual(3);
    });
});

describe("promotion depuis la file — le créateur occupe une place", () => {
    it("la capacité restante est comptée `ACCEPTED + 1 créateur`", () => {
        expect(ACTIONS_CODE).toContain("data.maxMembers - (acceptedCount + 1)");
    });
});
