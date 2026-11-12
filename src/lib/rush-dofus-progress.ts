/**
 * Progression d'un membre **sur un Dofus** — règle pure (modale « Progression Guilde par Dofus »).
 *
 * Pourquoi ce module : la progression est stockée par **bloc** (`PlayerGuideProgress.milestoneId`)
 * et par **étape** (`completedSteps`, clés `<subGuideRef>-<n>` / `<subGuideRef>-all`, cf.
 * `buildMilestoneStepKeys`), avec une étape courante (`currentStep`). La modale doit répondre à
 * « sur quelle quête en est-il, dans quelle catégorie » — sans requête supplémentaire, donc à
 * partir de ces trois choses.
 *
 * Une quête est **faite** quand **toutes** ses étapes le sont. L'étape courante du joueur est
 * prioritaire ; à défaut on retombe sur la première quête non terminée, et si tout est fait,
 * il n'y a plus de quête courante (on n'invente pas une position).
 */

import { RUSH_DOFUS_META, getDofusMeta } from "@/lib/rush-dofus-meta";

export type DofusQuestRef = {
    /** Bloc qui porte la quête (catégorie affichée). */
    milestoneId: string;
    /** Catégorie / chapitre du bloc (`chapterLabel` à défaut le titre). */
    category: string;
    /** Nom de la quête (libellé affiché). */
    label: string;
    /** `subGuideRef` : préfixe des clés d'étapes. */
    step: string;
    /** Nombre d'étapes de la quête (1 pour une quête « -all »). */
    steps: number;
};

export type MemberDofusProgress = {
    done: number;
    total: number;
    pct: number;
    /** Quête en cours, ou `null` si le Dofus est terminé (ou vide). */
    current: DofusQuestRef | null;
    /** Position (1-based) de la quête en cours, 0 si aucune. */
    currentIndex: number;
    /** Dernière quête terminée, `null` si rien n'est fait. */
    lastDone: DofusQuestRef | null;
};

/** Progression personnelle sur un Dofus, au grain du **bloc** (même règle que le panneau communautaire). */
export type DofusMilestoneStat = {
    id: string;
    label: string;
    color: string;
    imageUrl: string;
    done: number;
    total: number;
    pct: number;
};

/** Statut d'une **quête** dans la fiche d'un Dofus (interne et public). */
export type DofusQuestStatus = {
    id: string;
    name: string;
    category: string;
    /** Au moins une personne (ou le lecteur) a toutes les étapes de la quête. */
    done: boolean;
    /** Quelqu'un est actuellement sur cette quête (« rendu là »). */
    current: boolean;
    /** Communauté : nombre de personnes ayant validé la quête. */
    membersDone?: number;
    /** Communauté : nombre de personnes actuellement sur la quête. */
    membersHere?: number;
};

/**
 * Statut de chaque quête d'un Dofus pour un groupe de personnes.
 *
 * Une quête est « validée » quand **toutes ses étapes** le sont (`isQuestDone`) ; elle est
 * « en cours » quand l'étape courante d'une personne appartient à ses clés. Le lecteur
 * (mode personnel) passe par la même règle : il est un groupe d'une personne.
 */
export function questStatusForMembers(
    quests: DofusQuestRef[],
    members: ReadonlyArray<{ completedSteps?: Iterable<string>; currentStep?: string | null }>
): DofusQuestStatus[] {
    return quests.map((quest) => {
        const keys = questStepKeys(quest);
        let membersDone = 0;
        let membersHere = 0;
        for (const member of members) {
            const steps = new Set(member.completedSteps ?? []);
            if (isQuestDone(quest, steps)) {
                membersDone += 1;
            } else if (member.currentStep && keys.includes(member.currentStep)) {
                membersHere += 1;
            }
        }
        return {
            id: quest.step,
            name: quest.label,
            category: quest.category,
            done: membersDone > 0,
            current: membersHere > 0,
            membersDone,
            membersHere,
        };
    });
}

/**
 * Progression **par Dofus** d'une personne, à partir des blocs du guide et des blocs cochés.
 *
 * Pourquoi le bloc et pas l'étape : le panneau « Progression Communautaire » compte déjà les
 * blocs par Dofus (`GuildStatusPanel`) ; compter les étapes ici donnerait deux pourcentages
 * différents pour la même chose selon l'écran. Un bloc sans `dofusId` (chapitre non rattaché)
 * ou rattaché à un Dofus inconnu est **ignoré** — on n'invente pas une ligne.
 *
 * L'ordre est celui de `RUSH_DOFUS_META` (source unique des libellés, couleurs et visuels).
 */
export function dofusMilestoneStats(
    milestones: ReadonlyArray<{ id: string; dofusId?: string | null }>,
    completedMilestoneIds: Iterable<string>
): DofusMilestoneStat[] {
    const completed = new Set(completedMilestoneIds);
    const counts = new Map<string, { done: number; total: number }>();

    for (const milestone of milestones) {
        const key = milestone.dofusId?.trim().toLowerCase();
        if (!key || !getDofusMeta(key)) continue;
        const entry = counts.get(key) ?? { done: 0, total: 0 };
        entry.total += 1;
        if (completed.has(milestone.id)) entry.done += 1;
        counts.set(key, entry);
    }

    const out: DofusMilestoneStat[] = [];
    for (const meta of RUSH_DOFUS_META) {
        const entry = counts.get(meta.id);
        if (!entry || entry.total === 0) continue;
        out.push({
            id: meta.id,
            label: meta.label,
            color: meta.color,
            imageUrl: meta.imageUrl,
            done: entry.done,
            total: entry.total,
            pct: Math.round((entry.done / entry.total) * 100),
        });
    }
    return out;
}

/** Clés d'étapes d'une quête (`-all` et `-1` coexistent pour une quête non découpée). */
export function questStepKeys(quest: Pick<DofusQuestRef, "step" | "steps">): string[] {
    if (quest.steps <= 1) return [`${quest.step}-all`, `${quest.step}-1`];
    return Array.from({ length: quest.steps }, (_, index) => `${quest.step}-${index + 1}`);
}

/** Une quête est faite quand toutes ses étapes sont cochées. */
export function isQuestDone(quest: Pick<DofusQuestRef, "step" | "steps">, completedSteps: ReadonlySet<string>): boolean {
    if (quest.steps <= 1) {
        return completedSteps.has(`${quest.step}-all`) || completedSteps.has(`${quest.step}-1`);
    }
    return questStepKeys(quest).every((key) => completedSteps.has(key));
}

/** Progression d'un membre sur une liste ordonnée de quêtes d'un Dofus. */
export function memberDofusProgress(
    quests: DofusQuestRef[],
    completedSteps: Iterable<string>,
    currentStep: string | null | undefined
): MemberDofusProgress {
    const completed = new Set(completedSteps);
    const total = quests.length;
    const done = quests.filter((quest) => isQuestDone(quest, completed)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    let lastDone: DofusQuestRef | null = null;
    for (const quest of quests) {
        if (isQuestDone(quest, completed)) lastDone = quest;
    }

    // 1. L'étape courante du joueur, si elle appartient à une quête de CE Dofus.
    let current: DofusQuestRef | null = null;
    if (currentStep) {
        current = quests.find((quest) => questStepKeys(quest).includes(currentStep)) ?? null;
    }
    // 2. Sinon la première quête non terminée — jamais une quête déjà faite.
    if (!current) current = quests.find((quest) => !isQuestDone(quest, completed)) ?? null;

    const currentIndex = current ? quests.indexOf(current) + 1 : 0;
    return { done, total, pct, current, currentIndex, lastDone };
}
