"use server";

/**
 * Onglet « Sorts » d'une fiche stuff — récupération des sorts d'une classe depuis
 * DofusDB (`api.dofusdb.fr/spells`) + niveaux (`spell-levels`), cache Redis 24 h.
 *
 * La couche de transport (garde SSRF) vit dans `@/lib/dofusdb-fetch` ; ce module
 * est la couche métier : normalisation → `SpellBaseDamage`.
 */

import { logger } from "@/lib/logger";
import { getClassName } from "@/lib/dofusbook-utils";
import { applyCharLevelToSpells } from "@/lib/dofus-spells";
import {
    CLASS_SPELLS_TTL_MS,
    fetchClassSpellsFull,
    readSpellbook,
    upsertClassSpellbookWithJournal,
    type ClassSpellDamage,
    type ClassSpellGrade,
} from "@/lib/class-spells-siphon";

// 🧙 Le CŒUR (fetch DofusDB, normalisation, écriture + journal) vit dans
// `src/lib/class-spells-siphon.ts` depuis le 24/09/2026 : le worker BullMQ peut ainsi remplir les
// 19 grimoires **sans session Next**. Ici : garde d'accès + forme d'affichage (`applyCharLevelToSpells`).
export type { ClassSpellDamage, ClassSpellGrade };

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

export type ClassSpellsResponse = {
    classId: number;
    className: string;
    spells: ClassSpellDamage[];
    fromCache?: boolean;
};


/** Tri stable du grimoire : paires de variantes puis sorts de base d'abord. */
function sortSpells(spells: ClassSpellDamage[]): ClassSpellDamage[] {
    return [...spells].sort((a, b) => {
        if ((a.variantPairId || 0) !== (b.variantPairId || 0)) {
            return (a.variantPairId || 0) - (b.variantPairId || 0);
        }
        if (a.isVariant !== b.isVariant) {
            return a.isVariant ? 1 : -1;
        }
        return a.id - b.id;
    });
}

/**
 * Récupère tous les sorts d'une classe (sorts de base + variantes) pour un
 * niveau de personnage, en appliquant le grade par défaut adapté.
 *
 * Lecture : `ClassSpellbook` (DB, fraîcheur 24 h) → réseau DofusDB (persisté) →
 * repli stale (ligne périmée servie si DofusDB tombe). Le grade par défaut est
 * re-dérivé à la lecture (`applyCharLevelToSpells`) : une seule ligne par classe.
 */
export async function getClassSpells(classId: number, charLevel: number = 200): Promise<ActionResponse<ClassSpellsResponse>> {
    if (!Number.isInteger(classId) || classId < 1 || classId > 19) {
        return { success: false, error: "Classe invalide" };
    }

    const className = getClassName(classId) || "";
    const level = Number.isFinite(charLevel) && charLevel > 0 ? Math.floor(charLevel) : 200;

    const stored = await readSpellbook(classId);
    if (stored && stored.spells.length > 0) {
        const age = Date.now() - new Date(stored.updatedAt).getTime();
        if (age <= CLASS_SPELLS_TTL_MS) {
            return {
                success: true,
                data: { classId, className, spells: sortSpells(applyCharLevelToSpells(stored.spells, level)), fromCache: true },
            };
        }
    }

    try {
        const full = await fetchClassSpellsFull(classId);
        if (full.length > 0) {
            try {
                // 🔁 Écriture + **journal des changements** par une seule porte (aucune règle dupliquée).
                await upsertClassSpellbookWithJournal(classId, className, full);
            } catch {
                // Persistance optionnelle : la réponse reste servie même sans DB.
            }
        }
        return {
            success: true,
            data: { classId, className, spells: sortSpells(applyCharLevelToSpells(full, level)), fromCache: false },
        };
    } catch (err) {
        logger.error("[getClassSpells] Erreur:", { error: String(err) });
        if (stored && stored.spells.length > 0) {
            logger.warn(`[getClassSpells] Repli stale pour la classe ${classId}`);
            return {
                success: true,
                data: { classId, className, spells: sortSpells(applyCharLevelToSpells(stored.spells, level)), fromCache: true },
            };
        }
        return { success: false, error: "Impossible de charger les sorts de cette classe" };
    }
}
