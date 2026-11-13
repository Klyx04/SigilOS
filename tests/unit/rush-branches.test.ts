/**
 * Rush Sylvestre — vue **Branches à deux étages** (cité → Ordre).
 *
 * Cibles mesurées (Tougli, 21/10/2026) : **100** quêtes de cité bontarienne, **102** brâkmarienne,
 * **3 Ordres × 5 paliers** par cité (30 quêtes d'Ordre, nom propre par Ordre).
 *
 * 🔒 Ce que ces verrous interdisent :
 *  · compter une quête d'Ordre dans la série de cité (la cible 100/102 serait atteinte à tort) ;
 *  · présenter les positions 101-102 comme des « manques » (Brâkmar est plus long par nature) ;
 *  · perdre en silence une séquence dont la cité ou l'Ordre n'est pas reconnu.
 */

import { describe, it, expect } from "vitest";
import { ORDERS } from "@/lib/dofus-assets";
import {
    buildRushBranches,
    countMissingOrderSlots,
    RUSH_ORDER_LEVELS,
    type RushBranchSequence,
} from "@/lib/rush-branches";

const BONTA = ORDERS.bontarien[0];
const BRAK = ORDERS.brakmarien[0];

let nextOrder = 1;
function seq(overrides: Partial<RushBranchSequence> & { id: string }): RushBranchSequence {
    return {
        order: nextOrder++,
        subGuideName: overrides.id,
        alignReq: null,
        alignOrderCode: null,
        alignLevelReq: null,
        ...overrides,
    };
}

/** n quêtes de cité pour un camp, positions croissantes. */
function campSeries(camp: "bontarien" | "brakmarien", n: number, prefix: string): RushBranchSequence[] {
    return Array.from({ length: n }, (_, i) =>
        seq({ id: `${prefix}-${i + 1}`, alignReq: camp, subGuideName: `${prefix} ${i + 1}`, order: i + 1 }),
    );
}

describe("séries de cité — cible 100 / 102", () => {
    it("compte les deux séries et signale les manques", () => {
        const view = buildRushBranches([
            ...campSeries("bontarien", 100, "b"),
            ...campSeries("brakmarien", 98, "k"),
        ]);

        const [bonta, brak] = view.camps;
        expect(bonta).toMatchObject({ camp: "bontarien", target: 100, present: 100, missing: 0 });
        expect(brak).toMatchObject({ camp: "brakmarien", target: 102, present: 98, missing: 4 });
        expect(view.complete).toBe(false);
    });

    it("une quête d'Ordre ne compte JAMAIS dans la série de cité", () => {
        const view = buildRushBranches([
            ...campSeries("bontarien", 99, "b"),
            seq({ id: "ordre-1", alignReq: "bontarien", alignOrderCode: BONTA.id, alignLevelReq: 20 }),
        ]);

        expect(view.camps[0].present).toBe(99);
        expect(view.camps[0].missing).toBe(1);
    });

    it("les positions 101-102 sont hors miroir, pas des manques", () => {
        const view = buildRushBranches([
            ...campSeries("bontarien", 100, "b"),
            ...campSeries("brakmarien", 102, "k"),
        ]);

        expect(view.pairs).toHaveLength(102);
        expect(view.camps[1].beyondMirror).toBe(2);
        expect(view.camps[1].missing).toBe(0);
        expect(view.complete).toBe(true);

        expect(view.pairs[100].bontarien).toBeUndefined();
        expect(view.pairs[100].brakmarien?.id).toBe("k-101");
        expect(view.pairs[101].brakmarien?.id).toBe("k-102");
    });
});

describe("paires alignées par position", () => {
    it("signale un côté absent au milieu de la série", () => {
        const view = buildRushBranches([
            seq({ id: "b-1", alignReq: "bontarien", order: 1 }),
            seq({ id: "b-2", alignReq: "bontarien", order: 2 }),
            seq({ id: "k-1", alignReq: "brakmarien", order: 1 }),
        ]);

        expect(view.pairs[0]).toMatchObject({
            position: 1,
            bontarien: { id: "b-1" },
            brakmarien: { id: "k-1" },
        });
        expect(view.pairs[1]).toMatchObject({ position: 2, bontarien: { id: "b-2" } });
        expect(view.pairs[1].brakmarien).toBeUndefined();
    });

    it("est stable quel que soit l'ordre d'entrée", () => {
        const input = [
            seq({ id: "b-3", alignReq: "bontarien", order: 3 }),
            seq({ id: "b-1", alignReq: "bontarien", order: 1 }),
            seq({ id: "b-2", alignReq: "bontarien", order: 2 }),
        ];
        const view = buildRushBranches(input);
        expect(view.pairs.map((p) => p.bontarien?.id)).toEqual(["b-1", "b-2", "b-3"]);
    });
});

describe("étage 2 — 3 Ordres × 5 paliers", () => {
    it("produit 15 emplacements par cité et signale les vides", () => {
        const view = buildRushBranches([
            seq({ id: "o-20", alignReq: "bontarien", alignOrderCode: BONTA.id, alignLevelReq: 20 }),
            seq({ id: "o-40", alignReq: "bontarien", alignOrderCode: BONTA.id, alignLevelReq: 40 }),
            seq({ id: "k-20", alignReq: "brakmarien", alignOrderCode: BRAK.id, alignLevelReq: 20 }),
        ]);

        const bontaOrders = view.camps[0].orders;
        expect(bontaOrders).toHaveLength(ORDERS.bontarien.length);
        expect(bontaOrders.every((o) => o.slots.length === RUSH_ORDER_LEVELS.length)).toBe(true);

        const first = bontaOrders.find((o) => o.id === BONTA.id)!;
        expect(first.slots[0].sequences.map((s) => s.id)).toEqual(["o-20"]);
        expect(first.slots[0].label).toBe(BONTA.levels[20]);
        expect(first.missing).toBe(3); // 5 paliers − 2 remplis
        expect(countMissingOrderSlots(view)).toBeGreaterThan(0);
    });

    it("une quête d'Ordre sans palier est signalée, jamais comptée comme remplie", () => {
        const view = buildRushBranches([
            seq({ id: "sans-palier", alignReq: "bontarien", alignOrderCode: BONTA.id }),
        ]);

        const first = view.camps[0].orders.find((o) => o.id === BONTA.id)!;
        expect(first.unlevelled.map((s) => s.id)).toEqual(["sans-palier"]);
        expect(first.missing).toBe(5);
    });
});

/**
 * Le studio (S4-2) et l'import écrivent le code **canonique** (`coeur_vaillant`), le
 * catalogue `ORDERS` porte l'id **court** (`vaillant`) : les deux doivent remplir le
 * MÊME palier. C'est ce qui manquait le 27/10/2026 — les 30 quêtes importées tombaient
 * toutes « hors branche » et la vue restait à 0/5.
 */
describe("codes d'Ordre — les deux vocabulaires remplissent les mêmes paliers", () => {
    it("un code canonique remplit son palier (et n'est pas orphelin)", () => {
        const view = buildRushBranches([
            seq({ id: "ordre-cv", alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 20 }),
        ]);

        const vaillant = view.camps[0].orders.find((o) => o.id === BONTA.id)!;
        expect(vaillant.slots.find((s) => s.level === 20)?.sequences).toHaveLength(1);
        expect(vaillant.missing).toBe(4);
        expect(view.orphans).toEqual([]);
        expect(countMissingOrderSlots(view)).toBe(29);
    });

    it("l'id court du catalogue remplit le même palier", () => {
        const view = buildRushBranches([
            seq({ id: "ordre-court", alignReq: "bontarien", alignOrderCode: BONTA.id, alignLevelReq: 40 }),
        ]);

        const vaillant = view.camps[0].orders.find((o) => o.id === BONTA.id)!;
        expect(vaillant.slots.find((s) => s.level === 40)?.sequences).toHaveLength(1);
        expect(view.orphans).toEqual([]);
    });

    it("un Ordre de l'autre cité est signalé, jamais rattaché d'office", () => {
        const view = buildRushBranches([
            seq({ id: "croise", alignReq: "bontarien", alignOrderCode: "coeur_saignant", alignLevelReq: 20 }),
        ]);

        expect(view.orphans.map((s) => s.id)).toEqual(["croise"]);
        expect(countMissingOrderSlots(view)).toBe(30);
    });
});

/**
 * Position dans la série = **ordre du bloc** puis ordre interne. `order` seul repart à 0
 * dans chaque bloc : sans `blockOrder`, la vue triait par nom (alphabet) et « L'exorciste »
 * (100ᵉ quête) apparaissait en position 68 (mesure du 27/10/2026).
 */
describe("position — l'ordre du GUIDE, ni le `order` local, ni l'alphabet", () => {
    it("trie par bloc puis par ordre interne", () => {
        const view = buildRushBranches([
            // Alphabétiquement « Zébulon » < « Alfred » ? non : Alfred d'abord. On inverse donc
            // les blocs pour prouver que c'est le BLOC qui tranche, pas le nom.
            seq({ id: "b-zeb", alignReq: "bontarien", order: 0, blockOrder: 2, subGuideName: "Zébulon" }),
            seq({ id: "b-alf", alignReq: "bontarien", order: 0, blockOrder: 1, subGuideName: "Alfred" }),
        ]);
        expect(view.pairs.map((p) => p.bontarien?.subGuideName)).toEqual(["Alfred", "Zébulon"]);
    });

    it("apparie les deux camps par rang dans l'ordre du guide", () => {
        const view = buildRushBranches([
            // Dans le même bloc, « B deux » précède « B un » dans l'alphabet : l'ordre interne
            // doit gagner.
            seq({ id: "b-2", alignReq: "bontarien", order: 1, blockOrder: 1, subGuideName: "B deux" }),
            seq({ id: "b-1", alignReq: "bontarien", order: 0, blockOrder: 1, subGuideName: "B un" }),
            // Brâkmar arrive plus tard dans le guide (bloc 9) : l'appariement se fait au RANG.
            seq({ id: "k-2", alignReq: "brakmarien", order: 1, blockOrder: 9, subGuideName: "K deux" }),
            seq({ id: "k-1", alignReq: "brakmarien", order: 0, blockOrder: 9, subGuideName: "K un" }),
        ]);
        expect(view.pairs.map((p) => [p.bontarien?.subGuideName, p.brakmarien?.subGuideName])).toEqual([
            ["B un", "K un"],
            ["B deux", "K deux"],
        ]);
    });
});

describe("orphelins — aucune perte silencieuse", () => {
    it("une cité inconnue finit en orphelin", () => {
        const view = buildRushBranches([
            seq({ id: "neutre", alignReq: "neutre" }),
            seq({ id: "b-1", alignReq: "bontarien", order: 1 }),
        ]);

        expect(view.orphans.map((s) => s.id)).toEqual(["neutre"]);
        expect(view.pairs).toHaveLength(1);
    });

    it("un code d'Ordre inconnu finit en orphelin, hors des slots", () => {
        const view = buildRushBranches([
            seq({ id: "ordre-x", alignReq: "bontarien", alignOrderCode: "ordre-inexistant", alignLevelReq: 20 }),
        ]);

        expect(view.orphans.map((s) => s.id)).toEqual(["ordre-x"]);
        const total = view.camps[0].orders.reduce(
            (n, o) => n + o.slots.reduce((m, s) => m + s.sequences.length, 0),
            0,
        );
        expect(total).toBe(0);
    });
});
