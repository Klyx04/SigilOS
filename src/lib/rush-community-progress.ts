/**
 * Espace visiteur (rang 57) — **Progression Communautaire** (V2a-2) : règles pures, aucune I/O.
 *
 * Le panneau public reproduit le panneau interne (D-V8) à partir de la progression déjà stockée
 * par les visiteurs **consentants** (`PublicRushProgress`). Trois invariants :
 *
 *  · **consentement** : seules les lignes dont le profil porte `showRushProgress` arrivent ici
 *    (le filtre vit dans `src/server/rush-community.ts`) ; ce module ne connaît ni `userId` ni
 *    `publicProfileId` — l'identité affichable est un **nom de personnage**, jamais un compte ;
 *  · **borné** : un nom (40), des listes plafonnées — une ligne abîmée est ignorée, jamais une
 *    exception (les colonnes sont des `Json`, n'importe quoi peut y entrer) ;
 *  · **aucun agrégat inventé** : un membre sans bloc coché reste un membre à zéro.
 */

import { memberDofusProgress, type DofusQuestRef } from "@/lib/rush-dofus-progress";

export const COMMUNITY_MAX_MEMBERS = 200;
export const COMMUNITY_NAME_MAX = 40;
export const COMMUNITY_MAX_MILESTONES = 300;
export const COMMUNITY_MAX_DUNGEONS = 2_000;
export const COMMUNITY_MAX_STEPS = 10_000;
export const COMMUNITY_MAX_PER_DOFUS = 8;

export type CommunityMember = {
    /** Nom affichable : `characterName` du personnage, jamais le pseudo du compte. */
    name: string;
    /** Blocs terminés (ids de `GuideMilestone`). */
    completedMilestones: string[];
    /** Étapes cochées, tous blocs confondus (clés `<subGuideRef>-<n>` / `-all`). */
    completedSteps: string[];
    /** Étape en cours du joueur, même format que les clés d étapes. */
    currentStep: string | null;
    /** Donjons cochés « done » (clés `sequenceId::dungeonKey`). */
    dungeonDone: string[];
    /** Horodatage ISO de la dernière synchronisation (tri stable côté écran). */
    updatedAt: string;
};

/** Ligne brute telle que lue en base — les `Json` sont `unknown` par construction. */
export type CommunityRow = {
    characterName: string | null;
    completedMilestones: unknown;
    completedSteps: unknown;
    currentStep: string | null;
    dungeonChecks: unknown;
    updatedAt: Date;
    pseudoDofus: string | null;
};

/** Un nom de personnage exploitable, ou `null` (ligne ignorée). */
export function normalizeCommunityName(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const name = raw.trim().slice(0, COMMUNITY_NAME_MAX);
    return name.length > 0 ? name : null;
}

/** Tableau de chaînes bornées ; tout ce qui n'est pas une chaîne est écarté. */
export function readCommunityKeys(raw: unknown, max: number): string[] {
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const value of raw) {
        if (typeof value !== 'string' || value.length === 0) continue;
        out.push(value.slice(0, 200));
        if (out.length >= max) break;
    }
    return out;
}

/** Coches de donjons : seules les valeurs `"done"` comptent (closed set). */
export function readCommunityDungeons(raw: unknown): string[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (value !== 'done') continue;
        out.push(key.slice(0, 200));
        if (out.length >= COMMUNITY_MAX_DUNGEONS) break;
    }
    return out;
}

/**
 * Ligne Prisma → membre affichable, ou `null` si aucun nom ne peut être publié.
 * Le repli `pseudoDofus` n'est utilisé que si le personnage n'a pas de nom : le panneau ne
 * fabrique jamais un nom à partir d'un identifiant de compte.
 */
export function toCommunityMember(row: CommunityRow): CommunityMember | null {
    const name = normalizeCommunityName(row.characterName) ?? normalizeCommunityName(row.pseudoDofus);
    if (!name) return null;
    return {
        name,
        completedMilestones: readCommunityKeys(row.completedMilestones, COMMUNITY_MAX_MILESTONES),
        completedSteps: readCommunitySteps(row.completedSteps),
        currentStep: typeof row.currentStep === "string" ? row.currentStep.slice(0, 200) : null,
        dungeonDone: readCommunityDungeons(row.dungeonChecks),
        updatedAt: row.updatedAt.toISOString(),
    };
}

/** Avancement d'un membre sur le guide (blocs terminés / blocs du guide). */
export function memberCompletion(member: CommunityMember, totalMilestones: number): number {
    if (totalMilestones <= 0) return 0;
    const done = Math.min(member.completedMilestones.length, totalMilestones);
    return Math.round((done / totalMilestones) * 100);
}

/**
 * Tri d'affichage : les plus avancés d'abord, puis le nom (déterministe), puis la fraîcheur.
 * Une copie est rendue — l'appelant garde son tableau d'origine intact.
 */
export function sortCommunityMembers(members: CommunityMember[], totalMilestones: number): CommunityMember[] {
    return [...members].sort((a, b) => {
        const delta = memberCompletion(b, totalMilestones) - memberCompletion(a, totalMilestones);
        if (delta !== 0) return delta;
        const byName = a.name.localeCompare(b.name, 'fr');
        if (byName !== 0) return byName;
        return b.updatedAt.localeCompare(a.updatedAt);
    });
}
/** Étapes cochées : `Json` = `Record<milestoneId, string[]>`, aplati et borné. */
export function readCommunitySteps(raw: unknown): string[] {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const value of Object.values(raw as Record<string, unknown>)) {
        if (!Array.isArray(value)) continue;
        for (const step of value) {
            if (typeof step !== "string" || step.length === 0) continue;
            out.push(step.slice(0, 200));
            if (out.length >= COMMUNITY_MAX_STEPS) return out;
        }
    }
    return out;
}

/** Forme minimale d un bloc du guide, côté client (aucun import de type serveur). */
export type CommunityMilestoneLike = {
    id: string;
    title: string;
    chapterLabel?: string | null;
    dofusId?: string | null;
    sequences: Array<{
        subGuideRef: string;
        subGuideName?: string | null;
        stepFrom?: number | null;
        stepTo?: number | null;
    }>;
};

export type CommunityDofusMember = {
    name: string;
    done: number;
    total: number;
    pct: number;
    /** Libellé de la quête en cours, `null` si le Dofus est terminé. */
    current: string | null;
    currentIndex: number;
};

export type CommunityDofusStat = {
    id: string;
    totalMilestones: number;
    completedMilestones: number;
    pct: number;
    members: CommunityDofusMember[];
};

/**
 * Agrégation **par Dofus**, reproduction du panneau interne (D-V8) :
 * un jalon est « couvert » dès qu au moins un membre consenti l a terminé ; chaque membre
 * est ensuite situé **à la quête** (`memberDofusProgress`, même règle que l interne).
 */
export function communityDofusStats(
    members: CommunityMember[],
    milestones: readonly CommunityMilestoneLike[],
    /** Dofus **connus** du referentiel : un `dofusId` hors liste est ignore, comme
     *  l interne (`GuildStatusPanel` : `if (!def) return;`). Des jalons portent des ids
     *  qui ne sont pas des Dofus (`six-sur-six`, `quatre-sur-six`) : sans ce filtre ils
     *  apparaissaient en pastilles parasites (mesure du 08/11/2026). */
    allowedDofusIds?: ReadonlySet<string>
): CommunityDofusStat[] {
    const byDofus = new Map<string, { ids: Set<string>; quests: DofusQuestRef[] }>();
    for (const ms of milestones) {
        if (!ms.dofusId) continue;
        if (allowedDofusIds && !allowedDofusIds.has(ms.dofusId)) continue;
        const entry = byDofus.get(ms.dofusId) ?? { ids: new Set<string>(), quests: [] };
        entry.ids.add(ms.id);
        for (const seq of ms.sequences) {
            const steps =
                seq.stepFrom != null && seq.stepTo != null
                    ? Math.max(1, seq.stepTo - seq.stepFrom + 1)
                    : 1;
            entry.quests.push({
                milestoneId: ms.id,
                category: ms.chapterLabel || ms.title,
                label: seq.subGuideName || seq.subGuideRef,
                step: seq.subGuideRef,
                steps,
            });
        }
        byDofus.set(ms.dofusId, entry);
    }

    const out: CommunityDofusStat[] = [];
    for (const [id, entry] of byDofus) {
        const covered = members.filter((member) =>
            member.completedMilestones.some((milestoneId) => entry.ids.has(milestoneId))
        ).length;
        const totalMilestones = entry.ids.size;
        const rows = members
            .map((member) => {
                const progress = memberDofusProgress(
                    entry.quests,
                    member.completedSteps,
                    member.currentStep
                );
                return {
                    name: member.name,
                    done: progress.done,
                    total: progress.total,
                    pct: progress.pct,
                    current: progress.current?.label ?? null,
                    currentIndex: progress.currentIndex,
                };
            })
            .filter((row) => row.total > 0)
            .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, "fr"))
            .slice(0, COMMUNITY_MAX_PER_DOFUS);

        out.push({
            id,
            totalMilestones,
            completedMilestones: covered,
            pct: totalMilestones > 0 ? Math.round((covered / totalMilestones) * 100) : 0,
            members: rows,
        });
    }
    return out.sort((a, b) => b.totalMilestones - a.totalMilestones);
}
