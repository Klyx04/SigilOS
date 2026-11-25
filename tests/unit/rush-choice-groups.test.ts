import { describe, it, expect } from "vitest";
import {
    applyChoiceExclusivity,
    choiceGroupMetaForGroup,
    choiceGroupMetaTags,
    choiceRepresentatives,
    collapseChoiceGroups,
    getChoiceGroup,
    getChoiceGroupMeta,
    siblingChoiceIds,
    stepCounts,
    stripChoiceGroupTags,
    DEFAULT_CHOICE_GROUP_NOTE,
    MAX_CHOICE_GROUP_LENGTH,
} from "@/lib/rush-choice-groups";
import type { RushActivityTag } from "@/types/rush-guide-types";

const tag = (name: unknown): RushActivityTag[] =>
    [{ type: "choice_group", name: name as string }] as RushActivityTag[];

const seq = (id: string, group?: unknown) => ({
    id,
    activityTags: group === undefined ? [] : tag(group),
});

/**
 * Étape 55 (mesurée sur DPLN) : « Un maître ès pion » puis **une** des trois variantes.
 * L'étape doit compter pour **1**, pas pour 3, et être terminée dès qu'une variante est cochée.
 */
describe("rush-choice-groups — une étape, N variantes exclusives", () => {
    it("lit le groupe dans le tag, en le bornant", () => {
        expect(getChoiceGroup(seq("a", "55"))).toBe("55");
        expect(getChoiceGroup(seq("a", " 55 "))).toBe("55");
        expect(getChoiceGroup(seq("a"))).toBeNull();
        expect(getChoiceGroup(seq("a", ""))).toBeNull();
        expect(getChoiceGroup(seq("a", "x".repeat(120)))).toHaveLength(MAX_CHOICE_GROUP_LENGTH);
        expect(getChoiceGroup({ id: "a", activityTags: null })).toBeNull();
        // Un tag d'un autre type ne crée pas de groupe.
        expect(getChoiceGroup({ id: "a", activityTags: [{ type: "prereq_text", name: "55" }] })).toBeNull();
    });

    it("compte un groupe comme UNE étape, terminée dès qu'une variante est cochée", () => {
        const block = [
            seq("pion", "55"), // partie 1 de l'étape (même groupe) — ou hors groupe selon les données
            seq("magnanime", "55"),
            seq("kamas", "55"),
            seq("assassinat", "55"),
            seq("supermilicien"),
        ];

        expect(stepCounts(block, [])).toEqual({ total: 2, done: 0 });
        expect(stepCounts(block, ["assassinat"])).toEqual({ total: 2, done: 1 });
        expect(stepCounts(block, ["assassinat", "magnanime"])).toEqual({ total: 2, done: 1 });
        expect(stepCounts(block, ["assassinat", "supermilicien"])).toEqual({ total: 2, done: 2 });
    });

    it("ne regroupe que les séquences du même bloc (deux étapes 55 distinctes restent distinctes)", () => {
        const bonta = [seq("b-55", "55")];
        const brak = [seq("k-55", "55")];
        expect(stepCounts([...bonta], [])).toEqual({ total: 1, done: 0 });
        expect(stepCounts([...brak], [])).toEqual({ total: 1, done: 0 });
    });

    it("liste les sœurs d'une variante, jamais elle-même", () => {
        const block = [seq("magnanime", "55"), seq("kamas", "55"), seq("autre")];
        expect(siblingChoiceIds(seq("kamas", "55"), block)).toEqual(["magnanime"]);
        expect(siblingChoiceIds(seq("autre"), block)).toEqual([]);
        // La liste vient des séquences FOURNIES : une variante absente du lot est écartée
        // d'elle-même (jamais renvoyée), ses sœurs présentes restent listées.
        expect(siblingChoiceIds(seq("kamas", "55"), [seq("magnanime", "55")])).toEqual(["magnanime"]);
        expect(siblingChoiceIds(seq("kamas", "55"), [seq("kamas", "55")])).toEqual([]);
    });

    it("cocher une variante retire ses sœurs, et garde la première du lot", () => {
        const block = [
            seq("magnanime", "55"),
            seq("kamas", "55"),
            seq("assassinat", "55"),
            seq("supermilicien"),
        ];

        // On coche « kamas » alors que « magnanime » l'était déjà : magnanime saute.
        expect(applyChoiceExclusivity(block, ["magnanime", "kamas", "supermilicien"], ["kamas"])).toEqual([
            "kamas",
            "supermilicien",
        ]);
        // Deux variantes envoyées d'un coup : la première de la liste gagne.
        expect(applyChoiceExclusivity(block, ["kamas", "assassinat"], ["kamas", "assassinat"])).toEqual(["kamas"]);
        // Rien de nouveau : la liste est rendue intacte.
        expect(applyChoiceExclusivity(block, ["magnanime"], [])).toEqual(["magnanime"]);
        // Hors groupe : aucune interférence.
        expect(applyChoiceExclusivity(block, ["supermilicien", "kamas"], ["supermilicien"])).toEqual([
            "supermilicien",
            "kamas",
        ]);
    });
});

describe("carte de choix — regroupement et représentants", () => {
    const withTexts = (id: string, group: string, label?: string, note?: string) => ({
        id,
        activityTags: [
            { type: "choice_group", name: group },
            ...(label ? [{ type: "choice_group_label", name: label }] : []),
            ...(note ? [{ type: "choice_group_note", name: note }] : []),
        ],
    });

    it("regroupe les variantes à la place de la première, dans l'ordre du guide", () => {
        const block = [seq("avant"), withTexts("magnanime", "55"), withTexts("kamas", "55"), seq("apres")];
        const items = collapseChoiceGroups(block);
        expect(items.map((item) => item.kind)).toEqual(["sequence", "choice", "sequence"]);
        const card = items[1];
        if (card.kind !== "choice") throw new Error("carte attendue");
        expect(card.group).toBe("55");
        expect(card.sequences.map((s) => s.id)).toEqual(["magnanime", "kamas"]);
    });

    it("une variante seule redevient une ligne normale (route filtrée, recherche)", () => {
        expect(collapseChoiceGroups([withTexts("magnanime", "55")])[0]?.kind).toBe("sequence");
    });

    it("lit le libellé et la note sur n'importe quelle sœur, sans les dupliquer", () => {
        const block = [
            withTexts("magnanime", "55"),
            withTexts("kamas", "55", "Étape 55 · au choix", "Quêtes identiques, seul le nom change."),
            withTexts("assassinat", "55"),
        ];
        expect(getChoiceGroupMeta(block[0]!)).toEqual({ label: null, note: null });
        expect(choiceGroupMetaForGroup(block, "55")).toEqual({
            label: "Étape 55 · au choix",
            note: "Quêtes identiques, seul le nom change.",
        });
        expect(choiceGroupMetaTags({ label: "  ", note: "" })).toEqual([]);
        expect(choiceGroupMetaTags({ label: "Étape 55", note: DEFAULT_CHOICE_GROUP_NOTE })).toHaveLength(2);
    });

    it("remplace les trois tags de choix sans toucher aux autres", () => {
        const tags = [
            { type: "item", name: "Gelée" },
            { type: "choice_group", name: "55" },
            { type: "choice_group_label", name: "Étape 55" },
            { type: "choice_group_note", name: "Note" },
        ];
        expect(stripChoiceGroupTags(tags)).toEqual([{ type: "item", name: "Gelée" }]);
        expect(stripChoiceGroupTags(null)).toEqual([]);
    });

    it("ne garde qu'un représentant par groupe, en préférant une variante déjà cochée", () => {
        const block = [
            seq("magnanime", "55"),
            seq("kamas", "55"),
            seq("assassinat", "55"),
            seq("supermilicien"),
        ];
        const all = block.map((s) => s.id);
        // Rien de coché : la première dans l'ordre du guide gagne.
        expect(choiceRepresentatives(block, all, [])).toEqual(["magnanime", "supermilicien"]);
        // Une variante déjà cochée est conservée (on ne change pas son choix).
        expect(choiceRepresentatives(block, all, ["kamas"])).toEqual(["kamas", "supermilicien"]);
        // Hors groupe : rendu intact, dans l'ordre reçu.
        expect(choiceRepresentatives(block, ["supermilicien", "kamas"], [])).toEqual([
            "supermilicien",
            "kamas",
        ]);
    });
});
