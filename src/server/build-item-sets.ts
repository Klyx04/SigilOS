/**
 * 🔗 Résolution des **bonus de panoplie** d'un build — **serveur uniquement**.
 *
 * Pourquoi ici et pas dans la règle : la règle (`src/lib/dofus-set-bonuses.ts`) est pure et
 * ne connaît pas la base. Ce module fait le pont avec `GameItem` / `GameItemSet`, en **deux
 * requêtes bornées**, et uniquement pour les builds qui portent une variante.
 *
 * ⚠️ Ne jamais envoyer tout le catalogue au client (940 panoplies ≈ 380 ko) : on ne résout que
 * les panoplies **du build**. Un échec de lecture rend `null` (⇒ variante refusée à l'affichage),
 * jamais un contexte partiel qui ferait disparaître des bonus.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { normalizeItemSetTiers, type ItemSetData } from "@/lib/dofus-set-bonuses";
import type { DofusbookItem, DofusbookPreviewData } from "@/lib/dofusbook-utils";
import {
    applyVariantsToBuild,
    explainVariantRefusal,
    normalizeSavedVariants,
    type SavedVariant,
    type VariantItemSets,
    type VariantRefusal,
} from "@/lib/dofus-variant-utils";

/** Bornes : une page de galerie = 24 builds × 16 slots, plus les variantes. */
const MAX_ANKAMA_IDS = 512;
const MAX_SETS = 64;

/** Id Ankama d'un objet (identité commune entre Dofusbook et le catalogue). */
function ankamaIdOf(item: DofusbookItem | null | undefined): number {
    const id = Number(item?.official || item?.id || 0);
    return Number.isInteger(id) && id > 0 ? id : 0;
}

/**
 * Ids Ankama distincts des objets **effectifs** d'un build (stuff d'origine + variantes).
 * Les variantes écrasent le slot correspondant : un objet remplacé n'est pas collecté.
 */
export function collectBuildAnkamaIds(
    items: Record<string, DofusbookItem | null | undefined> | null | undefined,
    variants: Record<string, DofusbookItem | null | undefined> | null | undefined,
): number[] {
    const ids = new Set<number>();
    for (const slot of new Set<string>([...Object.keys(items ?? {}), ...Object.keys(variants ?? {})])) {
        const item = variants?.[slot] ?? items?.[slot];
        const id = ankamaIdOf(item);
        if (id > 0) ids.add(id);
    }
    return [...ids].slice(0, MAX_ANKAMA_IDS);
}

/**
 * Contexte de panoplies pour un ensemble d'objets.
 *
 * `null` = **impossible à résoudre** (panne de lecture, donnée illisible) : l'appelant laisse
 * la variante non calculable plutôt que d'afficher un total faux.
 */
export async function resolveVariantItemSets(ankamaIds: readonly number[]): Promise<VariantItemSets | null> {
    const ids = [...new Set(ankamaIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, MAX_ANKAMA_IDS);
    if (ids.length === 0) return { sets: {}, byItem: {} };

    try {
        const rows = await db.gameItem.findMany({
            where: { ankamaId: { in: ids } },
            select: { ankamaId: true, itemSetId: true },
        });

        const byItem: Record<number, number> = {};
        const setIds = new Set<number>();
        for (const row of rows) {
            const setId = Number(row.itemSetId ?? -1);
            if (!Number.isInteger(setId) || setId <= 0) continue;
            byItem[row.ankamaId] = setId;
            setIds.add(setId);
        }
        if (setIds.size === 0) return { sets: {}, byItem };

        const setRows = await db.gameItemSet.findMany({
            where: { id: { in: [...setIds].slice(0, MAX_SETS) } },
            select: { id: true, name: true, itemCount: true, tiers: true },
        });

        const sets: Record<number, ItemSetData> = {};
        for (const row of setRows) {
            // Une ligne dont les paliers ne sont pas un tableau est illisible ⇒ panoplie
            // **inconnue** (fail-closed). Un tableau **vide** est valide : panoplie sans bonus.
            if (!Array.isArray(row.tiers)) continue;
            sets[row.id] = { id: row.id, name: row.name, itemCount: row.itemCount, tiers: normalizeItemSetTiers(row.tiers) };
        }

        return { sets, byItem };
    } catch (error) {
        logger.warn("[build-item-sets] résolution des panoplies impossible", { error });
        return null;
    }
}

/**
 * Attache `itemSets` aux entrées qui portent une **variante** (les autres n'en ont pas besoin :
 * aucun coût, aucune requête). Une seule paire de requêtes pour toute la page.
 */
export async function attachItemSetsToBuilds<
    T extends { previewData?: unknown; variants?: unknown },
>(builds: T[]): Promise<Array<T & { itemSets?: VariantItemSets }>> {
    const withVariant = builds.filter((build) => {
        const variants = build.variants;
        return !!variants && typeof variants === "object" && !Array.isArray(variants)
            && Object.keys(variants as Record<string, unknown>).length > 0;
    });
    if (withVariant.length === 0) return builds;

    const ids = new Set<number>();
    for (const build of withVariant) {
        const preview = (build.previewData ?? null) as { items?: Record<string, DofusbookItem | null> } | null;
        for (const id of collectBuildAnkamaIds(preview?.items, build.variants as Record<string, DofusbookItem>)) {
            ids.add(id);
        }
    }

    const context = await resolveVariantItemSets([...ids]);
    if (!context) return builds; // ⇒ variante non calculable, affichage refusé explicitement

    return builds.map((build) => (withVariant.includes(build) ? { ...build, itemSets: context } : build));
}

/**
 * Aperçu **effectif** d'un build : celui de la variante quand elle est calculable, sinon celui du
 * stuff d'origine — avec la raison du refus le cas échéant.
 */
export interface EffectiveVariantPreview {
    /** Données à afficher (variante appliquée, ou stuff d'origine). */
    preview: DofusbookPreviewData | null;
    /** Variante assainie (vide s'il n'y en a pas). */
    variants: SavedVariant;
    /** La variante a-t-elle **réellement** été appliquée ? ⇒ tag « Variante » légitime. */
    variantApplied: boolean;
    /** Refus motivé quand la variante existe mais n'a pas pu être calculée. */
    refusal: VariantRefusal | null;
}

/**
 * Résout l'aperçu **à afficher** (image OG, embed Discord, partage).
 *
 * ⚠️ Une règle, trois usages : le tag « Variante » n'est posé que si le calcul a réussi — on
 * n'annonce jamais une variante qu'on n'a pas pu appliquer (fail-closed, comme la fiche).
 */
export async function resolveVariantPreview(
    previewData: DofusbookPreviewData | null | undefined,
    rawVariants: unknown,
): Promise<EffectiveVariantPreview> {
    const variants = normalizeSavedVariants(rawVariants);
    if (!previewData || Object.keys(variants).length === 0) {
        return { preview: previewData ?? null, variants, variantApplied: false, refusal: null };
    }

    const context = await resolveVariantItemSets(collectBuildAnkamaIds(previewData.items, variants));
    const computed = applyVariantsToBuild(previewData, variants, context);
    if (!computed) {
        return {
            preview: previewData,
            variants,
            variantApplied: false,
            refusal: explainVariantRefusal(previewData, variants, context),
        };
    }

    return { preview: computed, variants, variantApplied: true, refusal: null };
}
