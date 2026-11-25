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
import { isRushSequenceBannerMarker } from "@/lib/rush-block-types";
import { buildMilestoneStepKeys } from "@/lib/guide-progress-helpers";

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
    /** Id de la séquence Rush — cible du clic « ouvrir la quête » dans la timeline. */
    sequenceId?: string;
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
export type DofusQuestMemberStatus = {
    /** Nom affichable (personnage / pseudo du profil), borné par `questStatusForMembers`. */
    name: string;
    avatar?: string | null;
    /** Vrai pour le lecteur lui-même — la fiche affiche le badge « Moi ». */
    isViewer?: boolean;
    done: boolean;
    /** La personne est sur cette quête (repère « Je suis ici »). */
    current: boolean;
};

/** Statut d'une **quête** dans la fiche d'un Dofus (interne et public). */
export type DofusQuestStatus = {
    id: string;
    /** Id de la séquence Rush (clic vers la timeline), quand il est connu. */
    sequenceId?: string;
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
    /** Membres qui ont validé la quête ou qui y sont — jamais les « à faire ». */
    members?: DofusQuestMemberStatus[];
};

/**
 * Statut de chaque quête d'un Dofus pour un groupe de personnes.
 *
 * Une quête est « validée » quand **toutes ses étapes** le sont (`isQuestDone`) ; elle est
 * « en cours » quand l'étape courante d'une personne appartient à ses clés. Le lecteur
 * (mode personnel) passe par la même règle : il est un groupe d'une personne.
 *
 * `members` ne liste que les personnes **qui ont validé la quête ou qui y sont** : la fiche
 * ne remplit pas une liste avec des « à faire ». Le nom est facultatif — sans nom, la
 * personne compte dans les totaux mais n'est pas inventée à l'écran.
 */
export function questStatusForMembers(
    quests: DofusQuestRef[],
    members: ReadonlyArray<{
        completedSteps?: Iterable<string>;
        currentStep?: string | null;
        name?: string | null;
        avatar?: string | null;
        isViewer?: boolean;
    }>
): DofusQuestStatus[] {
    return quests.map((quest) => {
        const keys = questStepKeys(quest);
        let membersDone = 0;
        let membersHere = 0;
        const listed: DofusQuestMemberStatus[] = [];
        for (const member of members) {
            const steps = new Set(member.completedSteps ?? []);
            const done = isQuestDone(quest, steps);
            const current = !done && !!member.currentStep && keys.includes(member.currentStep);
            if (done) {
                membersDone += 1;
            } else if (current) {
                membersHere += 1;
            }
            const name =
                typeof member.name === "string" ? member.name.trim().slice(0, 80) : "";
            if (!name || (!done && !current)) continue;
            listed.push({
                name,
                avatar: member.avatar ?? null,
                isViewer: member.isViewer === true,
                done,
                current,
            });
        }
        return {
            id: quest.step,
            ...(quest.sequenceId ? { sequenceId: quest.sequenceId } : {}),
            name: quest.label,
            category: quest.category,
            done: membersDone > 0,
            current: membersHere > 0,
            membersDone,
            membersHere,
            members: listed,
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

/**
 * Progression **personnelle par Dofus**, au grain de la **quête**.
 *
 * Le panneau public affichait un pourcentage par **bloc** : cocher une quête ne le faisait
 * pas bouger tant que les 8 quêtes du bloc n'étaient pas finies (mesure du 20/11/2026).
 * Ici chaque séquence cochable compte pour 1, les succès (`isSuccess`) et les encarts
 * `info_sequence` sont écartés — ce ne sont pas des quêtes. Un Dofus inconnu est ignoré.
 */
export function dofusQuestStats(
    milestones: ReadonlyArray<{
        id: string;
        dofusId?: string | null;
        sequences?: ReadonlyArray<{
            id: string;
            isSuccess?: boolean;
            activityTags?: unknown;
        }>;
    }>,
    completedSequenceIds: Iterable<string>
): DofusMilestoneStat[] {
    const completed = new Set(completedSequenceIds);
    const counts = new Map<string, { done: number; total: number }>();

    for (const milestone of milestones) {
        const key = milestone.dofusId?.trim().toLowerCase();
        if (!key || !getDofusMeta(key)) continue;
        for (const sequence of milestone.sequences ?? []) {
            if (!sequence || typeof sequence.id !== "string") continue;
            if (sequence.isSuccess) continue;
            const tags = Array.isArray(sequence.activityTags) ? sequence.activityTags : [];
            // Encart conseil (`info_sequence`) ou bandeau Combat (`sequence_banner`) :
            // jamais une quête du pourcentage par Dofus (22/11/2026).
            if (tags.some((tag) => isRushSequenceBannerMarker(tag as { type?: string | null; kind?: string | null }))) {
                continue;
            }
            const entry = counts.get(key) ?? { done: 0, total: 0 };
            entry.total += 1;
            if (completed.has(sequence.id)) entry.done += 1;
            counts.set(key, entry);
        }
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

/**
 * Table `sequenceId → clés d'étape` pour un ensemble de blocs Rush.
 *
 * La base stocke `completedSteps` en **ids de séquence** pour le Rush (et en
 * clés `<subGuideRef>-<n>` pour le legacy Ganymède). Les règles de statut
 * (`questStatusForMembers`, `memberDofusProgress`) raisonnent en **clés** :
 * cette table est la projection unique, partagée par l'interne et le public.
 */
export function rushStepKeysBySequenceId(
    milestones: ReadonlyArray<{
        sequences?: ReadonlyArray<{
            id: string;
            subGuideRef: string;
            stepFrom?: number | null;
            stepTo?: number | null;
        }>;
    }>
): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const milestone of milestones) {
        for (const sequence of milestone.sequences ?? []) {
            map.set(sequence.id, buildMilestoneStepKeys([sequence]));
        }
    }
    return map;
}

/**
 * Projette des `completedSteps` Rush (ids de séquence) vers les clés d'étape
 * attendues par `questStatusForMembers`. Une valeur déjà au format clé
 * (Ganymède) est conservée telle quelle — jamais devinée.
 */
export function projectRushStepKeys(
    completedSteps: Iterable<string>,
    stepKeysBySequenceId: ReadonlyMap<string, readonly string[]>
): string[] {
    const out = new Set<string>();
    for (const raw of completedSteps) {
        const keys = stepKeysBySequenceId.get(raw);
        if (keys) {
            for (const key of keys) out.add(key);
        } else {
            out.add(raw);
        }
    }
    return [...out];
}

/**
 * Périmètre du panneau « Progression Guilde par Dofus » pour le lecteur.
 *
 * **Mesure du 25/11/2026** : le panneau fusionnait silencieusement **tous** les
 * emplacements d'un profil (`characterSlot`). Un joueur seul dans sa guilde, avec une
 * mule à 6 blocs validés, voyait donc les cartes rester à 100 % après avoir remis le
 * personnage principal à zéro — et le changement de personnage ne changeait rien.
 *
 * Règle (même convention que `getRushDungeonStates` : « moi » = l'emplacement
 * sélectionné, « les autres » = la guilde) : les lignes du lecteur sont réduites à son
 * **personnage actif** ; celles des autres membres restent intactes. Un emplacement
 * absent vaut `PRINCIPAL` (même normalisation que `buildGuildProgressRows`).
 * Sans profil lecteur, aucun filtrage : on ne cache jamais les autres membres.
 *
 * **Profils hérités (mesure bêta du 25/11/2026)** : un même compte peut garder un ancien
 * `UserProfile` avec de la progression. Ce n'est pas « un autre membre » : ses lignes sont
 * écartées du panneau (elles resteraient sinon à 100 % après le reset du profil courant).
 * La suppression réelle est faite par `resetGuideProgress` (tous les profils du compte).
 */
export function scopeGuildProgressForViewer<
    T extends { profileId: string; characterSlot?: string | null; userId?: string | null },
>(
    rows: readonly T[],
    viewer: {
        profileId: string | null | undefined;
        userId?: string | null;
        characterSlot: string;
    }
): T[] {
    if (!viewer.profileId) return [...rows];
    const activeSlot = viewer.characterSlot || "PRINCIPAL";
    return rows.filter((row) => {
        if (row.profileId === viewer.profileId) {
            return (row.characterSlot || "PRINCIPAL") === activeSlot;
        }
        if (viewer.userId && row.userId === viewer.userId) return false;
        return true;
    });
}

/**
 * Clés d'étapes d'un membre pour un ensemble de lignes de progression.
 *
 * **Un bloc `isCompleted` vaut toutes ses séquences** : la validation de bloc écrit
 * bien `completedSteps`, mais les données anciennes (ou une ligne réparée) peuvent
 * n'avoir que le drapeau. Sans cette règle, la fiche Dofus affichait « 1/1 bloc »
 * et « 0/8 quêtes » (mesure du 23/11/2026) : les ids de séquence n'étaient pas
 * projetés en clés de quête dans l'agrégat par membre.
 */
export function memberCompletedStepKeys(input: {
    rows: ReadonlyArray<{
        milestoneId: string;
        isCompleted: boolean;
        completedSteps?: readonly string[] | null;
    }>;
    sequenceIdsByMilestone: ReadonlyMap<string, readonly string[]>;
    stepKeysBySequenceId: ReadonlyMap<string, readonly string[]>;
}): string[] {
    const raw = new Set<string>();
    for (const row of input.rows) {
        for (const id of row.completedSteps ?? []) raw.add(id);
        if (!row.isCompleted) continue;
        for (const id of input.sequenceIdsByMilestone.get(row.milestoneId) ?? []) raw.add(id);
    }
    return projectRushStepKeys(raw, input.stepKeysBySequenceId);
}
