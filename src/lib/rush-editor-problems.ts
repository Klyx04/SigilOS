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

import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { isRushNonQuestBlock } from "@/lib/rush-block-types";

export type RushProblemSequence = {
    id: string;
    subGuideName?: string | null;
    subGuideRef?: string | null;
    tips?: string | null;
    questDbIds?: number[] | null;
    activityTags?: ReadonlyArray<{ type?: string | null }> | null;
    alignOrderCode?: string | null;
    alignLevelReq?: number | null;
    /** Cité déclarée (`bontarien` / `brakmarien`) — vide = commune. */
    alignReq?: string | null;
    /** Classe déclarée (`feca`, `iop`, …) — vide = commune. */
    classReq?: string | null;
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
    | "order-quest-without-level"
    | "class-quest-misrouted"
    | "alignment-quest-without-camp";

export type RushEditorProblemTarget = {
    blockId: string;
    blockTitle: string;
    questId?: string;
    questName?: string;
    /** Précision courte affichée à côté du nom (ex. « dit iop · route cra »). */
    detail?: string;
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

/** Blocs qui **accueillent** des quêtes : ni bandeau, ni bloc d'info (dont Combat). */
function hostsQuests(block: RushProblemMilestone): boolean {
    return !isRushNonQuestBlock(block.type);
}

const nameOf = (seq: RushProblemSequence) => seq.subGuideName || seq.subGuideRef || "(sans nom)";
const targetOf = (block: RushProblemMilestone, seq: RushProblemSequence): RushEditorProblemTarget => ({
    blockId: block.id,
    blockTitle: block.title,
    questId: seq.id,
    questName: nameOf(seq),
});

/** Minuscules sans accents : « Féca » et « feca » se comparent. */
function normalizeWord(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Classe citée par le NOM d'une quête, en **mot entier** — `null` si aucune.
 *
 * 🎯 Mesure du 12/11/2026 (715 séquences) : une recherche naïve par sous-chaîne
 * appariait des lieux (« Cania » → cra, « Srambad » → sram, « Ecaflipus » → ecaflip)
 * et rendait le contrôle inutilisable. En mot entier, il ne reste que les vrais noms.
 *
 * 🛡️ Sert au contrôle « quête de classe mal routée » : `classReq` vide ou différent
 * ⇒ la quête sort pour la mauvaise classe (ou pour les 19).
 */
export function classMentionedInName(name: string | null | undefined): string | null {
    const normalized = normalizeWord(name ?? "");
    if (!normalized) return null;
    for (const dofusClass of DOFUS_CLASSES) {
        const pattern = new RegExp(`(^|[^a-z])${dofusClass.id}([^a-z]|$)`);
        if (pattern.test(normalized)) return dofusClass.id;
    }
    return null;
}

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
 * Les sept manques du contenu, toujours dans le même ordre.
 *
 * ⚠️ La **route** (camps, Ordres, classes) reste pilotée par l'onglet Branches, qui montre
 * la **couverture** (`buildRushBranches`, `buildRushClassBranches`). Les deux derniers
 * contrôles ne la dupliquent pas : ils signalent une **saisie incohérente** que la
 * couverture ne peut pas voir — un nom de quête qui contredit sa classe, et un Ordre ou
 * un palier posé sans cité (la quête sort alors dans les deux camps).
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

    // Le NOM dit une classe, la route en déclare une autre (ou aucune) : la quête sort
    // pour la mauvaise classe, ou pour les 19 quand `classReq` est vide.
    const classMisrouted = collect(milestones, (block) =>
        hostsQuests(block)
            ? block.sequences.flatMap((seq) => {
                  const mentioned = classMentionedInName(seq.subGuideName ?? seq.subGuideRef);
                  if (!mentioned) return [];
                  const declared = (seq.classReq ?? "").trim().toLowerCase();
                  if (declared === mentioned) return [];
                  return [
                      {
                          ...targetOf(block, seq),
                          detail: `dit ${mentioned} · route ${declared || "aucune"}`,
                      },
                  ];
              })
            : [],
    );

    // Un Ordre ou un palier sans cité : la route ne peut pas trancher, la quête sort
    // dans les deux camps (l'inverse — cité sans Ordre — est normal pour les quêtes de cité).
    const alignmentWithoutCamp = collect(milestones, (block) =>
        hostsQuests(block)
            ? block.sequences
                  .filter((seq) => {
                      const hasOrder = (seq.alignOrderCode ?? "").trim() !== "";
                      const hasLevel = Boolean(seq.alignLevelReq);
                      const hasCamp = (seq.alignReq ?? "").trim() !== "";
                      return (hasOrder || hasLevel) && !hasCamp;
                  })
                  .map((seq) => ({
                      ...targetOf(block, seq),
                      detail: (seq.alignOrderCode ?? "").trim()
                          ? `Ordre ${seq.alignOrderCode}`
                          : `palier ${seq.alignLevelReq}`,
                  }))
            : [],
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
        {
            kind: "alignment-quest-without-camp",
            label: "Quêtes d'alignement sans cité",
            hint: "Un Ordre ou un palier sans cité : la quête sort dans les deux camps.",
            ...alignmentWithoutCamp,
        },
        {
            kind: "class-quest-misrouted",
            label: "Quêtes de classe mal routées",
            hint: "Le nom cite une classe, la route en déclare une autre (ou aucune).",
            ...classMisrouted,
        },
    ];
}

/** Total des manques — l'onglet affiche ce nombre sur sa pastille. */
export function countRushEditorProblems(problems: ReadonlyArray<RushEditorProblem>): number {
    return problems.reduce((total, problem) => total + problem.count, 0);
}
