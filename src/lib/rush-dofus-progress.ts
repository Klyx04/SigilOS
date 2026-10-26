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
