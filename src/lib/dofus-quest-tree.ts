/**
 * Succès imbriqués des quêtes Dofus — helpers PURS (aucun import serveur, testables).
 *
 * Dans Dofus, un succès contient soit une série de quêtes, soit une série de
 * succès imbriqués (« Le pays des Vermeils » → « Même pas malle » → ses quêtes).
 * On modélise ça sur l'entrée existante :
 *
 *   entryKind = "QUEST"       → quête jouable (comportement historique)
 *   entryKind = "ACHIEVEMENT" → succès conteneur d'objectifs (`parentEntryId`)
 *
 * Règles tenues ici :
 * - un succès conteneur ne compte JAMAIS comme une étape (poids 0) : les compteurs
 *   et le pourcentage d'un Dofus ne s'appuient que sur les quêtes jouables ;
 * - une entrée dont le parent est inconnu/absent remonte à la racine (jamais perdue à l'écran) ;
 * - un lien qui créerait un cycle est ignoré (l'entrée repasse à la racine).
 */

export const ACHIEVEMENT_KIND = "ACHIEVEMENT";
export const QUEST_KIND = "QUEST";

/** Forme minimale attendue d'une entrée (le reste des champs est libre). */
export interface QuestTreeEntry {
    id: string;
    name?: string | null;
    entryKind?: string | null;
    parentEntryId?: string | null;
    stepOrder?: number | null;
}

export interface QuestTree<T extends QuestTreeEntry> {
    /** Entrées sans parent (ordre d'affichage). */
    roots: T[];
    /** Objectifs d'un succès, indexés par id de parent. */
    childrenByParent: Map<string, T[]>;
    /** Profondeur d'affichage (0 = racine). */
    depthById: Map<string, number>;
    /** Quêtes jouables, dans l'ordre d'affichage DFS. */
    quests: T[];
}

/** Un succès conteneur ? (`entryKind` absent ⇒ quête, compat données historiques) */
export function isAchievement(entry: { entryKind?: string | null } | null | undefined): boolean {
    return (entry?.entryKind ?? QUEST_KIND) === ACHIEVEMENT_KIND;
}

/** Poids d'une entrée dans la progression d'un Dofus : 0 pour un succès conteneur. */
export function defaultEntryWeight(entryKind?: string | null): number {
    return entryKind === ACHIEVEMENT_KIND ? 0 : 1;
}

function sortEntries<T extends QuestTreeEntry>(entries: T[]): T[] {
    return [...entries].sort((a, b) => {
        const order = (a.stepOrder ?? 0) - (b.stepOrder ?? 0);
        if (order !== 0) return order;
        return String(a.id).localeCompare(String(b.id));
    });
}

/**
 * Construit l'arbre d'une section à partir de sa liste plate d'entrées.
 * Robuste : parent inconnu, parent qui n'est pas un succès ou lien cyclique
 * ⇒ l'entrée devient une racine (le contenu reste visible).
 */
export function buildQuestTree<T extends QuestTreeEntry>(entries: T[]): QuestTree<T> {
    const ordered = sortEntries(entries);
    const byId: Map<string, T> = new Map(ordered.map((e) => [e.id, e] as [string, T]));

    /** `startId` est-il ancêtre de `targetId` en remontant les parents ? */
    const reaches = (startId: string, targetId: string): boolean => {
        let current: string | undefined = startId;
        for (let guard = 0; current && guard < 64; guard++) {
            if (current === targetId) return true;
            const parentId: string | null | undefined = byId.get(current)?.parentEntryId;
            current = parentId ?? undefined;
        }
        return false;
    };

    const roots: T[] = [];
    const childrenByParent = new Map<string, T[]>();
    const depthById = new Map<string, number>();

    for (const entry of ordered) {
        const parentId = entry.parentEntryId || null;
        const parent = parentId ? byId.get(parentId) : undefined;
        // Parent utilisable : existe, n'est pas soi-même, est un succès, ne crée pas de cycle.
        const usable = !!parent && parent.id !== entry.id && isAchievement(parent) && !reaches(parent.id, entry.id);
        if (!usable) {
            roots.push(entry);
            continue;
        }
        const list = childrenByParent.get(parent!.id);
        if (list) list.push(entry);
        else childrenByParent.set(parent!.id, [entry]);
    }

    const quests: T[] = [];
    const walk = (entry: T, depth: number) => {
        depthById.set(entry.id, depth);
        if (!isAchievement(entry)) quests.push(entry);
        for (const child of childrenByParent.get(entry.id) ?? []) walk(child, depth + 1);
    };
    for (const root of roots) walk(root, 0);

    return { roots, childrenByParent, depthById, quests };
}

/** Retrouve une entrée de l'arbre par son id. */
export function findTreeEntry<T extends QuestTreeEntry>(tree: QuestTree<T>, id: string): T | undefined {
    const inRoots = tree.roots.find((e) => e.id === id);
    if (inRoots) return inRoots;
    for (const list of tree.childrenByParent.values()) {
        const found = list.find((e) => e.id === id);
        if (found) return found;
    }
    return undefined;
}

/** Tous les ids du sous-arbre (le nœud inclus). */
export function collectSubtreeIds<T extends QuestTreeEntry>(tree: QuestTree<T>, rootId: string): string[] {
    const ids: string[] = [];
    const walk = (id: string) => {
        ids.push(id);
        for (const child of tree.childrenByParent.get(id) ?? []) walk(child.id);
    };
    walk(rootId);
    return ids;
}

/** Ids des quêtes jouables du sous-arbre (le nœud inclus s'il est lui-même une quête). */
export function collectSubtreeQuestIds<T extends QuestTreeEntry>(tree: QuestTree<T>, rootId: string): string[] {
    return collectSubtreeIds(tree, rootId).filter((id) => {
        const entry = findTreeEntry(tree, id);
        return !!entry && !isAchievement(entry);
    });
}

/** Progression d'un nœud : quêtes validées / quêtes de son sous-arbre. */
export function nodeProgress<T extends QuestTreeEntry>(
    tree: QuestTree<T>,
    entry: T,
    completedIds: Set<string>
): { completed: number; total: number; percent: number } {
    const questIds = isAchievement(entry) ? collectSubtreeQuestIds(tree, entry.id) : [entry.id];
    const total = questIds.length;
    const completed = questIds.filter((id) => completedIds.has(id)).length;
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

/** Progression globale d'une section (quêtes jouables uniquement). */
export function questProgress<T extends QuestTreeEntry>(
    tree: QuestTree<T>,
    completedIds: Set<string>
): { completed: number; total: number; percent: number } {
    const total = tree.quests.length;
    const completed = tree.quests.filter((q) => completedIds.has(q.id)).length;
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

/**
 * Fusionne les compteurs de plusieurs sections (page par-Dofus) — les succès
 * conteneurs étant exclus de `quests`, ils n'inflatent jamais le total.
 */
export function sumQuestProgress(
    parts: Array<{ completed: number; total: number }>
): { completed: number; total: number; percent: number } {
    const completed = parts.reduce((sum, p) => sum + p.completed, 0);
    const total = parts.reduce((sum, p) => sum + p.total, 0);
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

/**
 * Un parent candidat créerait-il un cycle ? (soi-même, ou l'un de ses propres descendants)
 * Utilisé côté God avant d'enregistrer un « succès parent ».
 */
export function wouldCreateCycle<T extends QuestTreeEntry>(
    entries: T[],
    entryId: string | null | undefined,
    candidateParentId: string | null | undefined
): boolean {
    if (!candidateParentId || !entryId) return false;
    if (entryId === candidateParentId) return true;
    const byId = new Map(entries.map((e) => [e.id, e]));
    let current: string | null | undefined = candidateParentId;
    for (let guard = 0; current && guard < 64; guard++) {
        if (current === entryId) return true;
        current = byId.get(current)?.parentEntryId ?? null;
    }
    return false;
}

/**
 * Filtre de recherche / « masquer terminées » qui conserve les succès parents
 * des entrées restantes (sinon un objectif trouvé se retrouve orphelin à l'écran).
 */
export function filterTreeEntries<T extends QuestTreeEntry>(
    entries: T[],
    predicate: (entry: T) => boolean
): T[] {
    const byId = new Map(entries.map((e) => [e.id, e]));
    const kept = new Set<string>();
    for (const entry of entries) {
        if (!predicate(entry)) continue;
        kept.add(entry.id);
        let parentId: string | null | undefined = entry.parentEntryId;
        for (let guard = 0; parentId && guard < 64; guard++) {
            if (kept.has(parentId)) break;
            const parent = byId.get(parentId);
            if (!parent) break;
            kept.add(parent.id);
            parentId = parent.parentEntryId;
        }
    }
    return entries.filter((e) => kept.has(e.id));
}
