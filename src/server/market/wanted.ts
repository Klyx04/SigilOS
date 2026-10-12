/**
 * Lot M1 — recherches d'achat (WANTED) : validation serveur des critères de
 * jet (exo / over / trans) + libellés d'affichage + matching (V2).
 *
 * Règles (une seule source, serveur) :
 *   · l'objet existe au catalogue (fail-closed, jamais d'effet inventé) ;
 *   · `effectId` connu du référentiel `GameEffect` (fail-closed) ;
 *   · effet non natif ⇒ `exo: true` exigé (sinon refus explicite) ;
 *   · `minValue > naturalMax` ⇒ pastille OVER (jamais refusé, D34/D35) ;
 *   · libellé = cascade `resolveStatLabel` → référentiel → déclaré (S2.9) ;
 *   · max 8 critères/annonce, doublons d'`effectId` refusés.
 */

import { db } from "@/lib/prisma";
import { MARKET_LIMITS } from "@/server/actions/market-constants";
import { loadMarketReferential } from "@/lib/market/referential";
import {
    toNativeEffects,
    findNativeRange,
    applyEffectSign,
    isNegativeNativeEffect,
    isPlaceholderStatLabel,
    resolveStatLabel,
    type DofusItemEffectLike,
    type MarketNativeEffect,
} from "@/lib/market/effects";

export interface WantedCriterionInput {
    effectId: number;
    characteristic?: number | null;
    label: string;
    minValue: number;
    exo?: boolean;
}

export interface WantedCriterionRow {
    effectId: number;
    characteristic: number | null;
    label: string;
    minValue: number;
    naturalMax: number | null;
    exo: boolean;
    /** Pastille calculée : NATIVE | EXO | OVER. */
    tag: "NATIVE" | "EXO" | "OVER";
}

export type WantedCriteriaOutcome =
    | { ok: true; rows: WantedCriterionRow[] }
    | { ok: false; error: string };

const MAX_CRITERIA = 8;

/** `true` si la valeur ressemble à un libellé de repli (à remplacer). */
function isPlaceholderLabel(label: string): boolean {
    return isPlaceholderStatLabel(String(label ?? ""));
}

export async function resolveWantedCriteria(
    dofusDbItemId: number | null | undefined,
    criteria: WantedCriterionInput[]
): Promise<WantedCriteriaOutcome> {
    const list = Array.isArray(criteria) ? criteria : [];
    if (list.length === 0) return { ok: true, rows: [] };
    if (list.length > MAX_CRITERIA) {
        return { ok: false, error: `8 critères maximum par recherche (${list.length} reçus).` };
    }
    if (!Number.isInteger(dofusDbItemId) || (dofusDbItemId as number) <= 0) {
        return { ok: false, error: "Choisis un objet du catalogue pour une recherche d'achat." };
    }

    const seen = new Set<number>();
    for (const c of list) {
        if (!Number.isInteger(c?.effectId) || (c.effectId as number) <= 0) {
            return { ok: false, error: "Critère incomplet : effet non reconnu." };
        }
        if (seen.has(c.effectId)) return { ok: false, error: "Critère en double : un effet ne peut être exigé qu'une fois." };
        seen.add(c.effectId);
        if (!Number.isInteger(c?.minValue) || (c.minValue as number) < 1 || (c.minValue as number) > MARKET_LIMITS.STAT_VALUE_MAX) {
            return { ok: false, error: "Valeur minimale invalide : entre 1 et 99 999." };
        }
    }

    const [item, referential] = await Promise.all([
        db.gameItem.findUnique({
            where: { ankamaId: dofusDbItemId as number },
            select: { nativeEffects: true, effects: true, name: true },
        }),
        loadMarketReferential(),
    ]);
    if (!item) return { ok: false, error: "Objet inconnu du catalogue : choisis un objet existant." };

    const natives =
        (item.nativeEffects as MarketNativeEffect[] | null) ??
        toNativeEffects({ effects: (item.effects ?? null) as DofusItemEffectLike[] | null });

    const rows: WantedCriterionRow[] = [];
    for (const c of list) {
        const knownLabel =
            referential.effectLabels[c.effectId] ??
            (c.characteristic != null ? referential.labels[c.characteristic] : null);
        // Fail-closed : effet inconnu du référentiel = refus (jamais d'effet
        // inventé, même avec un libellé custom et `exo` coché).
        if (!knownLabel) {
            return { ok: false, error: "Effet inconnu du référentiel : choisis un effet dans la liste." };
        }
        const native = findNativeRange(natives, {
            effectId: c.effectId,
            characteristic: c.characteristic ?? null,
        });
        if (!native && !c.exo) {
            return {
                ok: false,
                error: "Cet effet n'est pas natif de l'objet : coche « Exo » pour l'exiger quand même.",
            };
        }
        const signed = native
            ? applyEffectSign(native, isNegativeNativeEffect(c.effectId, { negativeEffectIds: referential.negativeEffectIds }))
            : null;
        const naturalMax = signed ? signed.to : null;
        const tag: WantedCriterionRow["tag"] = !native
            ? "EXO"
            : naturalMax != null && c.minValue > naturalMax
              ? "OVER"
              : "NATIVE";
        const label =
            resolveStatLabel(
                { effectId: c.effectId, characteristic: c.characteristic ?? null },
                knownLabel
            ) ??
            (!isPlaceholderLabel(c.label) ? c.label : null) ??
            c.label;
        rows.push({
            effectId: c.effectId,
            characteristic: c.characteristic ?? null,
            label,
            minValue: c.minValue,
            naturalMax,
            // Normalisé : `exo` n'a de sens que hors-natif (un effet natif
            // coché « exo » redevient NATIVE/OVER — jamais de pastille fausse).
            exo: !native,
            tag,
        });
    }
    return { ok: true, rows };
}

/** Ligne d'affichage d'un critère (« +50 Force min », pastilles). */
export function describeWantedCriterion(row: Pick<WantedCriterionRow, "label" | "minValue" | "tag">): string {
    const sign = row.minValue >= 0 ? "+" : "";
    const badge = row.tag === "EXO" ? "✦ Exo " : row.tag === "OVER" ? "⤴ Over " : "";
    return `${badge}${sign}${row.minValue} ${row.label} min`;
}

/** Souhait de forge : libellé d'affichage (ANY = aucune ligne). */
export function describeWantedTranscendence(value: string | null | undefined): string | null {
    if (value === "REQUIRED") return "Transcendé exigé";
    if (value === "FORBIDDEN") return "Non-transcendé exigé (à forgemager)";
    return null;
}

/**
 * V2 — couverture d'une vente par une recherche : part des critères satisfaits
 * (`actualValue >= minValue`, exo/over/trans respectés). Pur et testé ; le
 * câblage de notification viendra en V2.
 */
export function matchWantedCoverage(
    wanted: Array<{ effectId: number; minValue: number; tag: string }>,
    wantedTranscendence: string | null | undefined,
    saleStats: Array<{ effectId: number; actualValue: number; origin?: string | null }>,
    saleTranscended: boolean
): { covered: number; total: number } {
    if (wanted.length === 0) return { covered: 0, total: 0 };
    if (wantedTranscendence === "REQUIRED" && !saleTranscended) {
        return { covered: 0, total: wanted.length };
    }
    if (wantedTranscendence === "FORBIDDEN" && saleTranscended) {
        return { covered: 0, total: wanted.length };
    }
    let covered = 0;
    for (const criterion of wanted) {
        const line = saleStats.find((s) => s.effectId === criterion.effectId);
        if (!line) continue;
        if (Math.floor(Number(line.actualValue)) < Math.floor(Number(criterion.minValue))) continue;
        if (criterion.tag === "EXO" && line.origin !== "EXO") continue;
        covered++;
    }
    return { covered, total: wanted.length };
}
