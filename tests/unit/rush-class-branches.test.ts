/**
 * Rush Sylvestre — vue **Classes** (3ᵉ étage de la route, G4 du 02/11/2026).
 *
 * Cibles mesurées : **19** quêtes de classe, une par classe jouable (`classReq` = id
 * stable). Ce que ces verrous interdisent :
 *  · rattacher d'office une valeur inconnue — la route la masque en fail-closed ;
 *  · compter deux quêtes pour une classe sans le signaler ;
 *  · laisser une quête de classe porter une cité/un Ordre (elle fausserait 100/102).
 */

import { describe, it, expect } from "vitest";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { buildRushClassBranches, type RushBranchSequence } from "@/lib/rush-branches";

let nextOrder = 1;
function seq(overrides: Partial<RushBranchSequence> & { id: string }): RushBranchSequence {
    return {
        order: nextOrder++,
        subGuideName: overrides.id,
        alignReq: null,
        alignOrderCode: null,
        alignLevelReq: null,
        classReq: null,
        ...overrides,
    };
}

const CLASS_IDS = DOFUS_CLASSES.map((c) => c.id);

describe("cible — les 19 classes jouables", () => {
    it("compte 19 emplacements, même sans aucune quête de classe", () => {
        const view = buildRushClassBranches([]);

        expect(view.target).toBe(DOFUS_CLASSES.length);
        expect(view.classes).toHaveLength(19);
        expect(view.present).toBe(0);
        expect(view.missing).toBe(19);
        expect(view.classes.every((c) => c.sequences.length === 0)).toBe(true);
    });

    it("une quête par classe remplit les 19 emplacements", () => {
        const view = buildRushClassBranches(
            CLASS_IDS.map((id, i) => seq({ id: `q-${id}`, classReq: id, order: i })),
        );

        expect(view.present).toBe(19);
        expect(view.missing).toBe(0);
        expect(view.classes.every((c) => c.sequences.length === 1)).toBe(true);
    });

    it("les quêtes communes, de cité et d'Ordre ne polluent pas la vue", () => {
        const view = buildRushClassBranches([
            seq({ id: "commune" }),
            seq({ id: "cité", alignReq: "bontarien" }),
            seq({ id: "ordre", alignReq: "bontarien", alignOrderCode: "coeur_vaillant" }),
        ]);

        expect(view.present).toBe(0);
        expect(view.unknown).toEqual([]);
        expect(view.misplaced).toEqual([]);
    });
});

describe("une classe = un emplacement", () => {
    it("deux quêtes pour la même classe restent visibles (doublon), sans gonfler la cible", () => {
        const view = buildRushClassBranches([
            seq({ id: "feca-1", classReq: "feca" }),
            seq({ id: "feca-2", classReq: "feca" }),
        ]);

        expect(view.present).toBe(1);
        expect(view.missing).toBe(18);
        const feca = view.classes.find((c) => c.id === "feca")!;
        expect(feca.sequences.map((s) => s.id)).toEqual(["feca-1", "feca-2"]);
    });

    it("tolère la casse de l'id (la route compare en minuscules)", () => {
        const view = buildRushClassBranches([seq({ id: "feca-maj", classReq: "FECA" })]);

        expect(view.present).toBe(1);
        expect(view.unknown).toEqual([]);
    });

    it("trie la série par bloc puis par ordre interne", () => {
        const view = buildRushClassBranches([
            seq({ id: "z", classReq: "feca", blockOrder: 2, order: 0, subGuideName: "Zébulon" }),
            seq({ id: "a", classReq: "feca", blockOrder: 1, order: 0, subGuideName: "Alfred" }),
        ]);

        const feca = view.classes.find((c) => c.id === "feca")!;
        expect(feca.sequences.map((s) => s.id)).toEqual(["a", "z"]);
    });
});

describe("aucune perte silencieuse", () => {
    it("une classe inconnue est nommée, jamais rattachée d'office", () => {
        const view = buildRushClassBranches([
            seq({ id: "ancien-id", classReq: "osa" }),
            seq({ id: "libelle", classReq: "Féca" }),
        ]);

        expect(view.unknown.map((s) => s.id)).toEqual(["ancien-id", "libelle"]);
        expect(view.present).toBe(0);
        expect(view.missing).toBe(19);
    });

    it("une quête de classe qui porte une cité est signalée, mais garde son emplacement", () => {
        const view = buildRushClassBranches([
            seq({ id: "double-axe", classReq: "feca", alignReq: "bontarien" }),
        ]);

        expect(view.misplaced.map((s) => s.id)).toEqual(["double-axe"]);
        expect(view.classes.find((c) => c.id === "feca")!.sequences).toHaveLength(1);
        expect(view.present).toBe(1);
    });

    it("une quête de classe qui porte un Ordre est signalée de la même façon", () => {
        const view = buildRushClassBranches([
            seq({ id: "avec-ordre", classReq: "feca", alignOrderCode: "coeur_vaillant" }),
        ]);

        expect(view.misplaced.map((s) => s.id)).toEqual(["avec-ordre"]);
    });

    it("une quête de classe qui porte un palier est signalée (le verrou compterait des quêtes de cité)", () => {
        const view = buildRushClassBranches([
            seq({ id: "avec-palier", classReq: "feca", alignLevelReq: 20 }),
        ]);

        expect(view.misplaced.map((s) => s.id)).toEqual(["avec-palier"]);
    });
});
