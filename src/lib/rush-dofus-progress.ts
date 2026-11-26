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
import { collapseChoiceGroups } from "@/lib/rush-choice-groups";
import type { RushActivityTag } from "@/types/rush-guide-types";

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
    /**
     * Étape à **choix exclusif** : une seule variante est jouée. `step` est le
     * représentant, `variantSteps` porte toutes les variantes. Une étape compte pour
     * **une** quête (règle 26/11/2026 : la fiche Dofus affichait 17/18 pour 17 quêtes).
     */
    variantSteps?: string[];
    /** Ids de séquence des variantes (surfaces qui lisent des ids, pas des clés). */
    variantSequenceIds?: string[];
    /** Nombre de variantes, pour l'affichage « N variantes » de la fiche. */
    variantCount?: number;
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
    /** Classe Dofus du personnage (icône à côté du pseudo). */
    dofusClass?: string | null;
    /** Vrai pour le lecteur lui-même — la fiche affiche le badge « Moi ». */
    isViewer?: boolean;
    /** Mule d'un personnage principal : pseudo du principal (étiquette « mule de X »). */
    muleOf?: string | null;
    done: boolean;
    /** La personne est sur cette quête (repère « Je suis ici »). */
    current: boolean;
};

/** Statut d'une **quête** dans la fiche d'un Dofus (interne et public). */
export type DofusQuestStatus = {
    id: string;
    /** Id de la séquence Rush (clic vers la timeline), quand il est connu. */
    sequenceId?: string;
    /** Étape à choix : nombre de variantes (affichage « N variantes »). */
    variantCount?: number;
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

/** Forme minimale d'une séquence, partagée par le dashboard, le public et la communauté. */
type DofusQuestSequenceLike = {
    id?: string;
    subGuideRef: string;
    subGuideName?: string | null;
    stepFrom?: number | null;
    stepTo?: number | null;
    isSuccess?: boolean;
    activityTags?: unknown;
};

/** Une séquence à variantes exclusives compte pour **une** étape. */
function sequenceStepCount(seq: DofusQuestSequenceLike): number {
    return seq.stepFrom != null && seq.stepTo != null
        ? Math.max(1, seq.stepTo - seq.stepFrom + 1)
        : 1;
}

/**
 * Quêtes d'un **bloc** pour la fiche Dofus, avec les étapes à choix **repliées**.
 *
 * Mesure du 26/11/2026 : la fiche Turquoise comptait les deux variantes de l'étape 66
 * comme deux quêtes (17/18, une « À faire » alors que l'autre était validée). Le bloc,
 * lui, comptait déjà une étape (`stepCounts`). Cette fonction construit la même unité :
 * un ref par quête simple, **un** ref par groupe de choix (variantes listées dans
 * `variantSteps`), et les encarts Conseil/Combat exclus.
 */
export function dofusQuestRefsForMilestone(
    milestone: {
        id: string;
        title: string;
        chapterLabel?: string | null;
        sequences: DofusQuestSequenceLike[];
    },
    options: { excludeSuccesses?: boolean } = {}
): DofusQuestRef[] {
    const category = milestone.chapterLabel ?? milestone.title;
    const normalized = milestone.sequences.map((sequence, index) => ({
        ...sequence,
        id: sequence.id ?? `__seq-${index}-${sequence.subGuideRef}`,
    }));
    const sequences = normalized.filter((sequence) => {
        const tags = Array.isArray(sequence.activityTags)
            ? (sequence.activityTags as RushActivityTag[])
            : [];
        if (tags.some((tag) => isRushSequenceBannerMarker(tag))) return false;
        if (options.excludeSuccesses && sequence.isSuccess) return false;
        return true;
    });

    return collapseChoiceGroups(sequences).map((item) => {
        if (item.kind === "sequence") {
            return {
                milestoneId: milestone.id,
                category,
                label: item.seq.subGuideName || item.seq.subGuideRef,
                step: item.seq.subGuideRef,
                steps: sequenceStepCount(item.seq),
                sequenceId: item.seq.id,
            };
        }
        const first = item.sequences[0];
        return {
            milestoneId: milestone.id,
            category,
            label: item.label || first.subGuideName || item.group,
            step: first.subGuideRef,
            steps: 1,
            sequenceId: first.id,
            variantSteps: item.sequences.map((sequence) => sequence.subGuideRef),
            variantSequenceIds: item.sequences.map((sequence) => sequence.id),
            variantCount: item.sequences.length,
        };
    });
}

export function questAllStepKeys(
    quest: Pick<DofusQuestRef, "step" | "steps" | "variantSteps">
): string[] {
    const steps = quest.variantSteps?.filter((step): step is string => !!step) ?? [];
    const keys = new Set<string>();
    for (const step of steps.length > 0 ? steps : [quest.step]) {
        for (const key of questStepKeys({ step, steps: quest.steps })) keys.add(key);
    }
    return [...keys];
}

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
        dofusClass?: string | null;
        isViewer?: boolean;
        /** Mule d'un principal : pseudo du principal. */
        muleOf?: string | null;
    }>
): DofusQuestStatus[] {
    return quests.map((quest) => {
        const keys = questAllStepKeys(quest);
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
                dofusClass: member.dofusClass ?? null,
                isViewer: member.isViewer === true,
                ...(member.muleOf ? { muleOf: member.muleOf } : {}),
                done,
                current,
            });
        }
        return {
            id: quest.step,
            ...(quest.sequenceId ? { sequenceId: quest.sequenceId } : {}),
            ...(quest.variantCount ? { variantCount: quest.variantCount } : {}),
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
        const refs = dofusQuestRefsForMilestone(
            {
                id: milestone.id,
                title: (milestone as any).title ?? "",
                chapterLabel: (milestone as any).chapterLabel ?? null,
                sequences: (milestone.sequences ?? []) as DofusQuestSequenceLike[],
            },
            { excludeSuccesses: true }
        );
        for (const ref of refs) {
            const entry = counts.get(key) ?? { done: 0, total: 0 };
            entry.total += 1;
            if (isQuestDoneBySequenceIds(ref, completed)) entry.done += 1;
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

/**
 * Regroupe des **personnages** par **compte** (propriétaire) pour les fiches Dofus.
 *
 * Mesure du 26/11/2026 : une quête affichait une ligne par personnage (Ikhellwa,
 * mule de Ikhellwa, autre mule de Ikhellwa…) ; à 50 membres × 5 personnages, la
 * fiche devenait un mur. L'unité d'affichage est le compte, le détail des mules
 * reste disponible dans le `+N` (title / compteur).
 *
 * Le propriétaire est `muleOf` quand il existe, sinon `name`. L'ordre de première
 * apparition est conservé ; une mule peut précéder son principal dans la liste.
 */
export function groupDofusMembersByOwner<T extends { name: string; muleOf?: string | null }>(
    members: ReadonlyArray<T>
): Array<{ owner: string; members: T[] }> {
    const groups = new Map<string, T[]>();
    for (const member of members) {
        const owner = (member.muleOf?.trim() || member.name).trim();
        if (!owner) continue;
        const list = groups.get(owner) ?? [];
        list.push(member);
        groups.set(owner, list);
    }
    return [...groups.entries()].map(([owner, grouped]) => ({
        owner,
        members: grouped,
    }));
}

/** Personnage principal d'un groupe (celui qui n'est pas une mule), sinon le premier. */
export function primaryDofusMember<T extends { name: string; muleOf?: string | null }>(
    members: ReadonlyArray<T>
): T | null {
    return members.find((member) => !member.muleOf) ?? members[0] ?? null;
}

/** Clés d'étapes d'une quête (`-all` et `-1` coexistent pour une quête non découpée). */
export function questStepKeys(quest: Pick<DofusQuestRef, "step" | "steps">): string[] {
    if (quest.steps <= 1) return [`${quest.step}-all`, `${quest.step}-1`];
    return Array.from({ length: quest.steps }, (_, index) => `${quest.step}-${index + 1}`);
}

/** Une quête est faite quand toutes ses étapes sont cochées. */
export function isQuestDone(
    quest: Pick<DofusQuestRef, "step" | "steps" | "variantSteps">,
    completedSteps: ReadonlySet<string>
): boolean {
    const variants = quest.variantSteps?.filter((step): step is string => !!step) ?? [];
    const steps = variants.length > 1 ? variants : [quest.step];
    return steps.some((step) => {
        const single = { step, steps: quest.steps };
        return quest.steps <= 1
            ? completedSteps.has(`${step}-all`) || completedSteps.has(`${step}-1`)
            : questStepKeys(single).every((key) => completedSteps.has(key));
    });
}

/**
 * Variante « ids de séquence » de `isQuestDone` pour les surfaces qui ne manipulent
 * que des ids (guide public, progression locale). Une étape à choix est validée dès
 * qu'**une** de ses variantes l'est.
 */
export function isQuestDoneBySequenceIds(
    quest: Pick<DofusQuestRef, "sequenceId" | "variantSequenceIds">,
    completedSequenceIds: ReadonlySet<string>
): boolean {
    const ids =
        quest.variantSequenceIds && quest.variantSequenceIds.length > 0
            ? quest.variantSequenceIds
            : quest.sequenceId
              ? [quest.sequenceId]
              : [];
    return ids.some((id) => completedSequenceIds.has(id));
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
        current = quests.find((quest) => questAllStepKeys(quest).includes(currentStep)) ?? null;
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
 * Un **personnage** du guide : un profil + un `characterSlot`. Le panneau « par Dofus »
 * doit voir chaque personnage séparément (principal, mules, autres membres) — jamais
 * fusionner les slots d'un profil.
 */
export type GuildCharacterProgress<T> = {
    key: string;
    profileId: string;
    characterSlot: string;
    /** Nom affiché : pseudo du profil pour le principal, pseudo de la mule sinon. */
    name: string;
    /** Pseudo du personnage principal quand cette entrée est une mule. */
    ownerName?: string | null;
    /** Vrai pour une mule (slot ≠ PRINCIPAL). */
    isMule: boolean;
    avatar?: string | null;
    /** Classe Dofus du personnage (icône à côté du pseudo). */
    dofusClass?: string | null;
    isViewer: boolean;
    rows: T[];
};

/**
 * Groupe des lignes `PlayerGuideProgress` par **personnage** (`profileId::characterSlot`).
 * Mesure du 25/11/2026 : le panneau agrégeait par profil et affichait « 1 membre » alors
 * qu'il fallait voir Wylan, Cubi-Devomi et Chaudsept séparément. Aucune fusion de slots.
 */
export function groupGuildProgressByCharacter<
    T extends {
        profileId: string;
        characterSlot?: string | null;
        userName: string;
        userAvatar?: string | null;
        dofusClass?: string | null;
    },
>(
    rows: readonly T[],
    viewer: { profileId?: string | null; characterSlot?: string | null }
): GuildCharacterProgress<T>[] {
    const map = new Map<string, GuildCharacterProgress<T>>();
    const viewerProfileId = viewer.profileId ?? null;
    const viewerSlot = viewer.characterSlot || "PRINCIPAL";
    for (const row of rows) {
        const slot = row.characterSlot || "PRINCIPAL";
        const key = `${row.profileId}::${slot}`;
        let entry = map.get(key);
        if (!entry) {
            const baseName = slot === "PRINCIPAL" ? row.userName : slot;
            const isMule = slot !== "PRINCIPAL";
            // Un personnage principal et une mule peuvent partager le même pseudo : le
            // slot « PRINCIPAL » garde le nom du profil, la mule est marquée comme telle.
            const name = isMule && baseName === row.userName ? `${baseName} (mule)` : baseName;
            entry = {
                key,
                profileId: row.profileId,
                characterSlot: slot,
                name,
                ownerName: isMule ? row.userName : null,
                isMule,
                avatar: row.userAvatar ?? null,
                dofusClass: row.dofusClass ?? null,
                isViewer: row.profileId === viewerProfileId && slot === viewerSlot,
                rows: [],
            };
            map.set(key, entry);
        }
        entry.rows.push(row);
    }
    return [...map.values()];
}

/**
 * Écarte seulement les **profils hérités du même compte** (même `userId`, `profileId`
 * différent), sans toucher aux autres slots du profil courant : le panneau doit montrer
 * toutes les mules du lecteur, mais pas un ancien profil dupliqué du même compte.
 */
export function excludeLegacyProfilesForViewer<
    T extends { profileId: string; userId?: string | null },
>(
    rows: readonly T[],
    viewer: { profileId?: string | null; userId?: string | null }
): T[] {
    if (!viewer.profileId || !viewer.userId) return [...rows];
    return rows.filter(
        (row) => row.profileId === viewer.profileId || row.userId !== viewer.userId
    );
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

/**
 * Remplace les lignes du **personnage actif** par l'état local du guide, sans toucher aux
 * autres personnages du profil ni aux autres membres.
 *
 * **Mesure du 26/11/2026** : le panneau « Ma progression par Dofus » ne lisait que la prop
 * serveur. Une rafale de coches ne déclenchait qu'un `router.refresh()` (leading) : le
 * panneau et la fiche restaient sur un état partiel alors que les blocs, eux, étaient à
 * jour en local. Le panneau consomme donc le même état que les blocs pour le personnage
 * actif ; les autres personnages restent alimentés par le serveur.
 */
export function mergeViewerProgressRows<
    T extends {
        profileId: string;
        milestoneId: string;
        characterSlot?: string | null;
    },
>(
    serverRows: readonly T[],
    viewerRows: readonly T[],
    viewer: { profileId: string; characterSlot?: string | null }
): T[] {
    const slot = viewer.characterSlot || "PRINCIPAL";
    const kept = serverRows.filter(
        (row) =>
            !(
                row.profileId === viewer.profileId &&
                (row.characterSlot || "PRINCIPAL") === slot
            )
    );
    return [...kept, ...viewerRows];
}
