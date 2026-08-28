"use server";

/**
 * Onglet « Sorts » d'une fiche stuff — récupération des sorts d'une classe depuis
 * DofusDB (`api.dofusdb.fr/spells`) + niveaux (`spell-levels`), cache Redis 24 h.
 *
 * La couche de transport (garde SSRF) vit dans `@/lib/dofusdb-fetch` ; ce module
 * est la couche métier : normalisation → `SpellBaseDamage`.
 */

import { logger } from "@/lib/logger";
import { withCache } from "@/lib/cache";
import { dofusdbFetch } from "@/lib/dofusdb-fetch";
import { getClassName } from "@/lib/dofusbook-utils";
import {
    spellDamageFromEffect,
    type SpellBaseDamage,
} from "@/lib/dofus-spells";

/** Normalise les accents/unicode pour comparer des libellés de classe (DofusDB vs SigilOS). */
function normalizeLabel(s: string): string {
    return String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/** Sort DofusDB simplifié pour l'affichage onglet Sorts. */
export interface ClassSpellDamage {
    id: number;
    name: string;
    imageUrl?: string;
    description?: string;
    apCost: number;
    minRange: number;
    maxRange: number;
    criticalChance: number;
    critMult: number;
    maxCastPerTurn: number;
    maxCastPerTarget: number;
    minCastInterval: number;
    zone: { shape: string; size: number; range: number } | null;
    grade: number;
    minPlayerLevel?: number;
    isVariant?: boolean;
    variantPairId?: number;
    variantSpellId?: number;
    variantSpellName?: string;
    damages: SpellBaseDamage[];
    /** Jet de dégâts en coup critique (criticalEffect DofusDB), pour le calcul réel du crit. */
    critDamages?: SpellBaseDamage[];
    /** Tous les grades du sort (niveaux « 1 2 3 » ou « 1 2 » à la Dofusbook). */
    grades?: ClassSpellGrade[];
}

/** Un grade (niveau) d'un sort : attributs + lignes de dégâts propres à ce niveau. */
export interface ClassSpellGrade {
    grade: number;
    minPlayerLevel?: number;
    apCost: number;
    minRange: number;
    maxRange: number;
    criticalChance: number;
    maxCastPerTurn: number;
    maxCastPerTarget: number;
    minCastInterval: number;
    zone: { shape: string; size: number; range: number } | null;
    damages: SpellBaseDamage[];
    /** Jet de dégâts en coup critique (criticalEffect DofusDB), pour le calcul réel du crit. */
    critDamages?: SpellBaseDamage[];
}

export type ClassSpellsResponse = {
    classId: number;
    className: string;
    spells: ClassSpellDamage[];
    fromCache?: boolean;
};

/** DofusDB : name/description sont des objets { fr, en, ... } ; img = icône. */
function pickL10n(v: any): string | undefined {
    if (v == null) return undefined;
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.fr || v.en || (Object.values(v)[0] as string);
    return undefined;
}

function gradeFromLevel(level: any): ClassSpellGrade {
    const effects: any[] = Array.isArray(level.effects)
        ? level.effects
        : level.effects ? Object.values(level.effects) : [];

    const damages: SpellBaseDamage[] = [];
    for (const eff of effects) {
        const dmg = spellDamageFromEffect(eff);
        if (dmg) damages.push({ ...dmg, grade: Number(level.grade ?? level.level ?? level.id ?? 0) });
    }

    // Jet de dégâts en coup critique (criticalEffect).
    const critEffects: any[] = Array.isArray(level.criticalEffect)
        ? level.criticalEffect
        : level.criticalEffect ? Object.values(level.criticalEffect) : [];
    const critDamages: SpellBaseDamage[] = [];
    for (const eff of critEffects) {
        const dmg = spellDamageFromEffect(eff);
        if (dmg) critDamages.push({ ...dmg, grade: Number(level.grade ?? level.level ?? level.id ?? 0) });
    }

    const range = Number(level.range ?? level.maxRange ?? 0);
    const pz = (Array.isArray(level.previewZones) && level.previewZones.length > 0 ? level.previewZones[0] : null) || level.zone || null;

    return {
        grade: Number(level.grade ?? level.level ?? 0),
        minPlayerLevel: Number(level.minPlayerLevel ?? 1),
        apCost: Number(level.apCost ?? 0),
        minRange: Math.min(Number(level.minRange ?? 0), range || Number(level.minRange ?? 0)),
        maxRange: range,
        criticalChance: Number(level.criticalHitProbability ?? level.criticalChance ?? level.criticalHit ?? 0),
        maxCastPerTurn: Number(level.maxCastPerTurn ?? level.maxCastsPerTurn ?? 0),
        maxCastPerTarget: Number(level.maxCastPerTarget ?? level.maxCastsPerTarget ?? 0),
        minCastInterval: Number(level.minCastInterval ?? 0),
        zone: pz && typeof pz === "object"
            ? { shape: String(pz.type || pz.shape || "Cercle"), size: Number(pz.size ?? 0), range: Number(pz.range ?? range) }
            : null,
        damages,
        critDamages: critDamages.length > 0 ? critDamages : undefined,
    };
}

function normalizeSpell(spell: any): ClassSpellDamage | null {
    const id = Number(spell?.id);
    if (!Number.isFinite(id) || id <= 0) return null;

    const level = spell?._level
        || (Array.isArray(spell?.spellLevels) ? spell.spellLevels[spell.spellLevels.length - 1] : null);
    if (!level) return null;

    const g = gradeFromLevel(level);

    return {
        id,
        name: pickL10n(spell.name) || `Sort ${id}`,
        imageUrl: spell.imageUrl || spell.img,
        description: pickL10n(spell.description),
        critMult: 1.5,
        ...g,
    };
}

/**
 * Récupère tous les sorts d'une classe (sorts de base + variantes) via DofusDB.
 *
 * 1. `/breeds` → trouve le breedId selon le nom de la classe.
 * 2. `/spell-variants?breedId={id}&$limit=50&lang=fr` → récupère les 22 paires (44 sorts).
 * 3. `/spell-levels` → récupère tous les niveaux de sort par batchs de 40 (contourne le limit de 50 de DofusDB).
 * 4. Normalise chaque sort avec tous ses grades et pré-sélectionne le grade adapté au niveau du personnage.
 * Cache 24 h.
 */
export async function getClassSpells(classId: number, charLevel: number = 200): Promise<ActionResponse<ClassSpellsResponse>> {
    if (!Number.isInteger(classId) || classId < 1 || classId > 19) {
        return { success: false, error: "Classe invalide" };
    }

    const className = getClassName(classId) || "";

    try {
        const spells = await withCache<ClassSpellDamage[]>(
            `dofusbook:class-spells:v3:${classId}:lvl${charLevel}`,
            86400,
            async () => {
                // 1. Trouve la classe dans /breeds
                const breeds = (await dofusdbFetch<any[]>("/breeds?$limit=22&lang=fr")) || [];
                if (breeds.length === 0) return [];

                const target = normalizeLabel(className);
                const breed = breeds.find(
                    (b) => b?.shortName?.fr && normalizeLabel(b.shortName.fr) === target
                );
                if (!breed) return [];

                const breedId = Number(breed.id ?? breed.m_id ?? classId);

                // 2. Récupère les variantes de sorts (22 paires de sorts pour la classe)
                const variants = (await dofusdbFetch<any[]>(`/spell-variants?breedId=${breedId}&$limit=50&lang=fr`)) || [];
                
                type RawSpellWithMeta = {
                    raw: any;
                    isVariant: boolean;
                    variantPairId: number;
                    variantSpellId?: number;
                    variantSpellName?: string;
                };

                const rawSpellsList: RawSpellWithMeta[] = [];
                const allLevelIds = new Set<number>();

                if (variants.length > 0) {
                    variants.forEach((v: any, vIdx: number) => {
                        const pairSpells: any[] = Array.isArray(v.spells) ? v.spells : [];
                        const baseSpell = pairSpells[0];
                        const variantSpell = pairSpells[1];

                        pairSpells.forEach((s: any, sIdx: number) => {
                            if (!s || !s.id) return;
                            const otherSpell = sIdx === 0 ? variantSpell : baseSpell;
                            rawSpellsList.push({
                                raw: s,
                                isVariant: sIdx > 0,
                                variantPairId: Number(v.id ?? vIdx + 1),
                                variantSpellId: otherSpell?.id ? Number(otherSpell.id) : undefined,
                                variantSpellName: otherSpell ? pickL10n(otherSpell.name) : undefined,
                            });
                            (Array.isArray(s?.spellLevels) ? s.spellLevels : []).forEach((id: any) => {
                                const n = Number(id);
                                if (Number.isFinite(n) && n > 0) allLevelIds.add(n);
                            });
                        });
                    });
                } else {
                    // Fallback si pas de spell-variants : utilise breedSpellsId
                    const spellIds: number[] = (Array.isArray(breed.breedSpellsId) ? breed.breedSpellsId : [])
                        .map((n: any) => Number(n))
                        .filter((n: number) => Number.isFinite(n) && n > 0);
                    if (spellIds.length === 0) return [];

                    const spellQuery = spellIds.map((id) => `id[$in][]=${id}`).join("&");
                    const rawSpells = (await dofusdbFetch<any[]>(`/spells?${spellQuery}&$limit=100&lang=fr`)) || [];
                    rawSpells.forEach((s: any, idx: number) => {
                        rawSpellsList.push({
                            raw: s,
                            isVariant: false,
                            variantPairId: idx + 1,
                        });
                        (Array.isArray(s?.spellLevels) ? s.spellLevels : []).forEach((id: any) => {
                            const n = Number(id);
                            if (Number.isFinite(n) && n > 0) allLevelIds.add(n);
                        });
                    });
                }

                // 3. Récupère tous les spellLevels par batchs de 40 (max limit DofusDB = 50)
                const levelMap: Record<number, any> = {};
                if (allLevelIds.size > 0) {
                    const ids = Array.from(allLevelIds);
                    const chunks: number[][] = [];
                    for (let i = 0; i < ids.length; i += 40) {
                        chunks.push(ids.slice(i, i + 40));
                    }
                    const batchResults = await Promise.all(
                        chunks.map((chunk) => {
                            const q = chunk.map((id) => `id[$in][]=${id}`).join("&");
                            return dofusdbFetch<any[]>(`/spell-levels?${q}&$limit=50&lang=fr`);
                        })
                    );
                    batchResults.forEach((levels) => {
                        (levels || []).forEach((l: any) => {
                            if (l && l.id) levelMap[Number(l.id)] = l;
                        });
                    });
                }

                // 4. Normalise chaque sort avec tous ses grades
                const out: ClassSpellDamage[] = [];
                rawSpellsList.forEach(({ raw: s, isVariant, variantPairId, variantSpellId, variantSpellName }) => {
                    const spellLevelIds: number[] = (Array.isArray(s?.spellLevels) ? s.spellLevels : [])
                        .map((id: any) => Number(id))
                        .filter((n: number) => Number.isFinite(n) && n > 0);

                    // Niveaux résolus, triés par grade croissant
                    const levels = spellLevelIds
                        .map((lvId) => levelMap[Number(lvId)])
                        .filter((l: any) => !!l)
                        .sort((a: any, b: any) =>
                            (Number(a.grade ?? a.level ?? 0) - Number(b.grade ?? b.level ?? 0))
                            || (Number(a.minPlayerLevel ?? 1) - Number(b.minPlayerLevel ?? 1))
                        );

                    if (levels.length === 0) return;

                    // Grade par défaut = le plus élevé accessible pour ce personnage
                    const accessible = levels.filter((l: any) => Number(l.minPlayerLevel ?? 1) <= charLevel);
                    const chosen = (accessible.length > 0 ? accessible[accessible.length - 1] : levels[0]) || levels[0];

                    const normalized = normalizeSpell({ ...s, _level: chosen });
                    if (!normalized) return;

                    normalized.isVariant = isVariant;
                    normalized.variantPairId = variantPairId;
                    normalized.variantSpellId = variantSpellId;
                    normalized.variantSpellName = variantSpellName;
                    normalized.grades = levels.map((l: any) => gradeFromLevel(l));
                    out.push(normalized);
                });

                return out;
            }
        );

        // Tri par variantPairId puis sorts de base d'abord
        spells.sort((a, b) => {
            if ((a.variantPairId || 0) !== (b.variantPairId || 0)) {
                return (a.variantPairId || 0) - (b.variantPairId || 0);
            }
            if (a.isVariant !== b.isVariant) {
                return a.isVariant ? 1 : -1;
            }
            return a.id - b.id;
        });

        return {
            success: true,
            data: { classId, className, spells, fromCache: spells.length > 0 },
        };
    } catch (err) {
        logger.error("[getClassSpells] Erreur:", { error: String(err) });
        return { success: false, error: "Impossible de charger les sorts de cette classe" };
    }
}
