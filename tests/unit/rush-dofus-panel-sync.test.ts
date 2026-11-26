import { describe, expect, it } from "vitest";

import {
    memberCompletedStepKeys,
    memberDofusProgress,
    mergeViewerProgressRows,
    questStatusForMembers,
    rushStepKeysBySequenceId,
    type DofusQuestRef,
} from "@/lib/rush-dofus-progress";

/**
 * Panneau « Ma progression par Dofus » — une quête cochée doit être **validée** dans la
 * fiche, même quand son bloc n'est pas terminé et que la prop serveur est encore en retard.
 *
 * Mesure du 26/11/2026 (exemple Ocre) : les blocs affichaient la coche, mais la fiche
 * restait sur « À faire » parce qu'elle ne lisait que la prop serveur. La fusion de l'état
 * local doit projeter l'id de séquence en clé d'étape et marquer la quête.
 */

const milestones = [
    {
        id: "ms-ocre",
        dofusId: "ocre",
        sequences: [
            { id: "seq-1", subGuideRef: "L'éternelle moisson" },
            { id: "seq-2", subGuideRef: "Protéger et sévir" },
        ],
    },
];

const sequenceIdsByMilestone = new Map([["ms-ocre", ["seq-1", "seq-2"]]]);
const stepKeysBySequenceId = rushStepKeysBySequenceId(milestones);

const quests: DofusQuestRef[] = [
    {
        milestoneId: "ms-ocre",
        category: "Dofus Ocre",
        label: "L'éternelle moisson",
        step: "L'éternelle moisson",
        steps: 1,
        sequenceId: "seq-1",
    },
    {
        milestoneId: "ms-ocre",
        category: "Dofus Ocre",
        label: "Protéger et sévir",
        step: "Protéger et sévir",
        steps: 1,
        sequenceId: "seq-2",
    },
];

describe("panneau Dofus — synchronisation avec l'état local", () => {
    it("une quête cochée est validée même si son bloc n'est pas terminé", () => {
        const rows = [
            {
                profileId: "p1",
                milestoneId: "ms-ocre",
                characterSlot: "Cubi-Devomi",
                isCompleted: false,
                completedSteps: ["seq-1"],
                currentStep: null,
            },
        ];

        const keys = memberCompletedStepKeys({
            rows,
            sequenceIdsByMilestone,
            stepKeysBySequenceId,
        });
        const [first, second] = questStatusForMembers(quests, [
            { name: "Cubi-Devomi", completedSteps: keys, muleOf: "Wylan" },
        ]);

        expect(first.done).toBe(true);
        expect(first.members?.[0]?.muleOf).toBe("Wylan");
        expect(second.done).toBe(false);

        const progress = memberDofusProgress(quests, keys, null);
        expect(progress.done).toBe(1);
        expect(progress.total).toBe(2);
        expect(progress.pct).toBe(50);
    });

    it("la fusion remplace la ligne serveur du personnage actif", () => {
        const serverRows = [
            {
                profileId: "p1",
                milestoneId: "ms-ocre",
                characterSlot: "Cubi-Devomi",
                isCompleted: false,
                completedSteps: [],
                currentStep: null,
            },
        ];
        const localRows = [
            {
                ...serverRows[0],
                completedSteps: ["seq-1"],
            },
        ];

        const merged = mergeViewerProgressRows(serverRows, localRows, {
            profileId: "p1",
            characterSlot: "Cubi-Devomi",
        });

        expect(merged).toHaveLength(1);
        expect(merged[0].completedSteps).toEqual(["seq-1"]);
    });
});
