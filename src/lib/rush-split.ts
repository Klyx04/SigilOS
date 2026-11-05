/**
 * Règles pures du **split d'un bloc multi-quêtes** (God Rush).
 *
 * Un bloc de la bêta est une seule `GuideSequence` qui porte N `questDbIds` (un palier
 * de 20 quêtes, un Ordre de 5, les 19 classes…). Le split en fait N séquences de 1
 * quête, à la **même position** dans le bloc/chapitre, pour que chaque quête puisse
 * ensuite être déplacée individuellement.
 *
 * Ce que le plan garantit :
 *  · la **route** du bloc est recopiée : cité, Ordre, palier (dérivé par position pour
 *    un Ordre), classe (table `RUSH_CLASS_QUESTS` pour les 19 quêtes de classe) ;
 *  · les **tips / note / icône** du bloc restent sur la **première** quête (un texte de
 *    bloc n'est pas un texte de quête) ;
 *  · les **tags et donjons par quête** viennent de la donnée enrichie (jamais l'union du
 *    bloc, qui écraserait les 20 quêtes avec les ressources de toutes) ;
 *  · l'ordre suit `block.order + i`, donc la série est conservée.
 */
import { normalizeAlignmentCamp } from "@/lib/rush-route";

export const RUSH_ORDER_LEVELS = [20, 40, 60, 80, 100] as const;

export type RushSplitMeta = {
    name?: string | null;
    classReq?: string | null;
    activityTags?: unknown[];
    dungeonIds?: string[];
    mapPositions?: unknown[];
    dofusdbUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
};

export type RushSplitBlock = {
    id: string;
    order: number;
    subGuideName: string;
    subGuideRef?: string | null;
    questDbIds: number[];
    alignReq?: string | null;
    alignOrderCode?: string | null;
    alignLevelReq?: number | null;
    classReq?: string | null;
    tips?: string | null;
    note?: string | null;
    isSuccess?: boolean;
    icon?: string | null;
    metamobMonsterId?: number | null;
    activityTags?: unknown[];
    dungeonIds?: string[];
    dungeonOptionalIds?: string[];
    dofusdbUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
};

export type RushSplitDraft = {
    subGuideRef: string;
    subGuideName: string;
    order: number;
    questDbIds: number[];
    alignReq: string | null;
    alignOrderCode: string | null;
    alignLevelReq: number | null;
    classReq: string | null;
    tips: string | null;
    note: string | null;
    isSuccess: boolean;
    icon: string | null;
    metamobMonsterId: number | null;
    activityTags: unknown[];
    dungeonIds: string[];
    dungeonOptionalIds: string[];
    mapPositions: unknown[];
    dofusdbUrl: string | null;
    dofuspourlesnoobsUrl: string | null;
};

function stripAccents(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Cité d'un bloc : `alignReq` d'abord, puis les tags `alignment_set`, puis le titre
 * (`Alignement Bonta…`, `Alignement Brâkmarien…`). `null` = bloc commun (classes,
 * quêtes générales) — jamais une valeur devinée au hasard.
 */
export function inferAlignmentCamp(
    title: string,
    alignReq?: string | null,
    tags?: unknown[] | null,
): "bontarien" | "brakmarien" | null {
    const direct = normalizeAlignmentCamp(alignReq);
    if (direct) return direct;

    for (const tag of Array.isArray(tags) ? tags : []) {
        const t = tag as { type?: string; camp?: string | null; name?: string | null };
        if (t?.type !== "alignment_set") continue;
        const camp = normalizeAlignmentCamp(t.camp) ?? normalizeAlignmentCamp(t.name);
        if (camp) return camp;
    }

    const normalized = stripAccents(title ?? "");
    if (normalized.includes("bonta")) return "bontarien";
    if (normalized.includes("brakmar")) return "brakmarien";
    return null;
}

/**
 * Plan de split : `[]` si la séquence ne porte pas plusieurs quêtes. Aucune écriture ici.
 */
export function buildRushSplitPlan(
    block: RushSplitBlock,
    metaOf: (questDbId: number) => RushSplitMeta | undefined,
): RushSplitDraft[] {
    const questIds = Array.isArray(block.questDbIds) ? block.questDbIds.filter((id) => Number.isInteger(id) && id > 0) : [];
    if (questIds.length <= 1) return [];

    const camp = inferAlignmentCamp(block.subGuideName, block.alignReq, block.activityTags);
    const showsRank = !!(block.alignOrderCode ?? "").trim();

    return questIds.map((questDbId, index) => {
        const meta = metaOf(questDbId);
        const name = (meta?.name ?? "").trim() || `${block.subGuideName} — ${index + 1}`;
        return {
            subGuideRef: name,
            subGuideName: name,
            order: block.order + index,
            questDbIds: [questDbId],
            alignReq: camp,
            alignOrderCode: block.alignOrderCode ?? null,
            // Un Ordre a 5 rangs : le palier se déduit de la position, jamais du bloc.
            alignLevelReq: showsRank
                ? (RUSH_ORDER_LEVELS[index] ?? block.alignLevelReq ?? null)
                : (block.alignLevelReq ?? null),
            // La table des 19 classes prime : la base locale avait `cra` partout.
            classReq: meta?.classReq ?? (questIds.length === 1 ? block.classReq ?? null : null),
            tips: index === 0 ? block.tips ?? null : null,
            note: index === 0 ? block.note ?? null : null,
            isSuccess: block.isSuccess ?? false,
            icon: index === 0 ? block.icon ?? null : null,
            metamobMonsterId: index === 0 ? block.metamobMonsterId ?? null : null,
            // Jamais l'union du bloc : les ressources/donjons par quête viennent de la donnée enrichie.
            activityTags: Array.isArray(meta?.activityTags) ? meta.activityTags : [],
            dungeonIds: Array.isArray(meta?.dungeonIds) ? meta.dungeonIds : [],
            dungeonOptionalIds: [],
            mapPositions: Array.isArray(meta?.mapPositions) ? meta.mapPositions : [],
            dofusdbUrl: meta?.dofusdbUrl ?? null,
            dofuspourlesnoobsUrl: meta?.dofuspourlesnoobsUrl ?? null,
        };
    });
}
