/**
 * Studio Rush — **panneau « Problèmes »** (E3b, 12/11/2026).
 *
 * 🎯 Mesure du 12/11/2026 : le studio ne disait nulle part ce qui **manque** dans le guide.
 * Il fallait déplier les blocs un par un pour voir un conseil vide, une quête sans lien
 * DofusDB, une quête sans ressource ou une quête d'Ordre sans palier. L'onglet Branches
 * couvre la **route** ; ce module couvre le **contenu** — les deux ne se recouvrent pas.
 *
 * 🛡️ Règle PURE : aucune lecture base, aucune mutation, aucun libellé métier inventé.
 * Chaque problème porte la **cible** de navigation (bloc, et quête quand il y en a une),
 * pour que le panneau ouvre l'inspecteur au bon endroit.
 */

export type RushProblemSequence = {
    id: string;
    subGuideName?: string | null;
    subGuideRef?: string | null;
    tips?: string | null;
    questDbIds?: number[] | null;
    activityTags?: ReadonlyArray<{ type?: string | null }> | null;
    alignOrderCode?: string | null;
    alignLevelReq?: number | null;
};

export type RushProblemMilestone = {
    id: string;
    title: string;
    /** `SEPARATEUR` et `INFO` ne portent pas de quête : hors périmètre. */
    type?: string | null;
    sequences: ReadonlyArray<RushProblemSequence>;
};

export type RushEditorProblemKind =
    | "empty-block"
    | "quest-without-tips"
    | "quest-without-qid"
    | "quest-without-resource"
    | "order-quest-without-level";

export type RushEditorProblemTarget = {
    blockId: string;
    blockTitle: string;
    questId?: string;
    questName?: string;
};

export type RushEditorProblem = {
    kind: RushEditorProblemKind;
    label: string;
    /** Ce que ça empêche, en une ligne. */
    hint: string;
    count: number;
    /** Premières cibles (12 max) — le panneau compte, il ne déverse pas 300 lignes. */
    targets: ReadonlyArray<RushEditorProblemTarget>;
};

/** Blocs qui **accueillent** des quêtes : ni bandeau, ni bloc d'info. */
function hostsQuests(block: RushProblemMilestone): boolean {
    return block.type !== "SEPARATEUR" && block.type !== "INFO";
}

const nameOf = (seq: RushProblemSequence) => seq.subGuideName || seq.subGuideRef || "(sans nom)";
const targetOf = (block: RushProblemMilestone, seq: RushProblemSequence): RushEditorProblemTarget => ({
    blockId: block.id,
    blockTitle: block.title,
    questId: seq.id,
    questName: nameOf(seq),
});

function collect(
    milestones: ReadonlyArray<RushProblemMilestone>,
    pick: (block: RushProblemMilestone) => ReadonlyArray<RushEditorProblemTarget>,
): { count: number; targets: RushEditorProblemTarget[] } {
    const all = milestones.flatMap((block) => [...pick(block)]);
    // ⚠️ On ne coupe **pas** ici : la règle dit la vérité, le **panneau** pagine
    // l'affichage (12 puis 50 par clic). Une coupe dans la règle rendait
    // « + 324 autres » définitivement mort (mesuré le 12/11/2026).
    return { count: all.length, targets: all };
}

/**
 * Les cinq manques du contenu, toujours dans le même ordre.
 *
 * ⚠️ La **route** (camps, Ordres, classes) n'est pas ici : c'est l'onglet Branches, qui
 * possède déjà ses règles (`buildRushBranches`, `buildRushClassBranches`). Un seul sujet,
 * une seule règle.
 */
export function analyzeRushEditorProblems(
    milestones: ReadonlyArray<RushProblemMilestone>,
): RushEditorProblem[] {
    const emptyBlock = collect(milestones, (block) =>
        hostsQuests(block) && block.sequences.length === 0
            ? [{ blockId: block.id, blockTitle: block.title }]
            : [],
    );

    const withoutTips = collect(milestones, (block) =>
        hostsQuests(block)
            ? block.sequences.filter((seq) => !(seq.tips ?? "").trim()).map((seq) => targetOf(block, seq))
            : [],
    );

    const withoutQid = collect(milestones, (block) =>
        hostsQuests(block)
            ? block.sequences
                  .filter((seq) => !Array.isArray(seq.questDbIds) || seq.questDbIds.length === 0)
                  .map((seq) => targetOf(block, seq))
            : [],
    );

    const withoutResource = collect(milestones, (block) =>
        hostsQuests(block)
            ? block.sequences
                  .filter(
                      (seq) =>
                          !Array.isArray(seq.activityTags) ||
                          !seq.activityTags.some((tag) => tag.type === "item"),
                  )
                  .map((seq) => targetOf(block, seq))
            : [],
    );

    const orderWithoutLevel = collect(milestones, (block) =>
        block.sequences
            .filter((seq) => (seq.alignOrderCode ?? "").trim() && !seq.alignLevelReq)
            .map((seq) => targetOf(block, seq)),
    );

    return [
        {
            kind: "empty-block",
            label: "Blocs sans quête",
            hint: "Un bloc vide n'apprend rien au joueur.",
            ...emptyBlock,
        },
        {
            kind: "quest-without-tips",
            label: "Quêtes sans conseil",
            hint: "Le bloc « conseils » restera vide côté membre.",
            ...withoutTips,
        },
        {
            kind: "quest-without-qid",
            label: "Quêtes sans lien DofusDB",
            hint: "Pas de fiche de quête liée : ni prérequis, ni récompenses.",
            ...withoutQid,
        },
        {
            kind: "quest-without-resource",
            label: "Quêtes sans ressource",
            hint: "Aucun objet requis : l'agrégation des ressources les ignore.",
            ...withoutResource,
        },
        {
            kind: "order-quest-without-level",
            label: "Quêtes d'Ordre sans palier",
            hint: "La chaîne des rangs est cassée (le rang N exige le N−1).",
            ...orderWithoutLevel,
        },
    ];
}

/** Total des manques — l'onglet affiche ce nombre sur sa pastille. */
export function countRushEditorProblems(problems: ReadonlyArray<RushEditorProblem>): number {
    return problems.reduce((total, problem) => total + problem.count, 0);
}
