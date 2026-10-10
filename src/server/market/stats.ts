/**
 * Module « Marché » — résolution serveur des jets (S2.8/S2.9, correctif 10/10/2026).
 *
 * ⚠️ Fichier **serveur uniquement** (Prisma + référentiel). Il porte l'**unique**
 * implémentation du recalcul des stats (plages natives du catalogue + qualité
 * recalculée, jamais le client) : l'annonce unitaire (`market-actions`) ET le
 * lot multiple (`bundle`, jet **par objet**) la consomment — **une seule source
 * de vérité** (§13.4), jamais dupliquée.
 *
 * (Déplacé depuis `market-actions.ts` le 10/10/2026 : ce fichier d'actions est
 * scanné par `tests/unit/action-contracts.test.ts` qui exige `{ success, … }`
 * sur chaque `export async function` — un helper pur n'y a pas sa place.)
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { computeStatQuality, computeStatsHash } from "@/lib/market/stat-quality";
import {
    applyEffectSign,
    findNativeRange,
    isNegativeNativeEffect,
    isPlaceholderStatLabel,
    isStatBearingStatRow,
    normalizeNativeRange,
    resolveStatLabel,
    resolveStoredStatLabel,
    toNativeEffects,
    type DofusItemEffectLike,
    type MarketNativeEffect,
} from "@/lib/market/effects";
import { loadMarketReferential } from "@/lib/market/referential";
import { MARKET_LIMITS } from "@/server/actions/market-constants";

/** Ligne de jet reçue du client (sans `quality`, recalculée ici). */
const serverStatInputSchema = z.object({
    effectId: z.number().int(),
    characteristic: z.number().int().nullable().optional(),
    label: z.string().trim().min(1).max(80),
    naturalMin: z.number().int().nullable().optional(),
    naturalMax: z.number().int().nullable().optional(),
    actualValue: z
        .number()
        .int()
        .min(MARKET_LIMITS.STAT_VALUE_MIN)
        .max(MARKET_LIMITS.STAT_VALUE_MAX),
    origin: z.enum(["NATIVE", "EXO"]).default("NATIVE"),
});

export type ServerStatInput = z.infer<typeof serverStatInputSchema>;

/**
 * S2.8/S2.9 — Recalcule les stats **côté serveur** : la plage native provient
 * **toujours** du catalogue (`GameItem.nativeEffects`) et jamais du client (§12.8).
 * Un effet non natif est étiqueté `EXO` (jamais refusé, D34/D35) ; le libellé est
 * tiré du référentiel data-driven (S2.5bis) avec repli sur le libellé déclaré.
 */
export async function resolveServerStats(
    dofusDbItemId: number | null | undefined,
    stats: ServerStatInput[]
): Promise<{
    rows: Omit<Prisma.MarketListingStatCreateManyInput, "listingId">[];
    hash: string | null;
}> {
    if (stats.length === 0) return { rows: [], hash: null };

    const [item, referential] = await Promise.all([
        dofusDbItemId
            ? db.gameItem.findUnique({
                  where: { ankamaId: dofusDbItemId },
                  select: { nativeEffects: true, effects: true },
              })
            : Promise.resolve(null),
        loadMarketReferential(),
    ]);
    // 🛡️ Filet de sécurité (S2.12) : `nativeEffects` est vide sur les lignes
    // siphonnées AVANT l'ajout de la colonne (données périmées). On dérive alors
    // les plages depuis `effects` (forme brute DofusDB tolérée, `diceNum`/
    // `diceSide`). Lecture seule : la réparation définitive (backfill) se fait
    // depuis le panneau God, et le prochain siphon complète les données.
    const natives =
        (item?.nativeEffects as MarketNativeEffect[] | null) ??
        toNativeEffects({ effects: item?.effects as DofusItemEffectLike[] | null });

    // Correction 13/09 — effets dont la ligne est un **malus** (référentiel
    // `GameEffect.isNegativeValue`, avec repli curated mesuré) : les dés d'un
    // objet étant toujours positifs, c'est ici que le signe est rétabli (source
    // serveur, jamais le client).

    const mapped = stats.map((stat) => {
        const native = findNativeRange(natives, {
            effectId: stat.effectId,
            characteristic: stat.characteristic ?? null,
        });
        // Correction 13/09 — le SIGNE d'affichage est rétabli AVANT
        // persistance : DofusDB stocke les dés d'un objet toujours positifs,
        // le malus (« -6 à -8 Esquive PA ») vient du référentiel d'effets
        // (`isNegativeValue`). Les bornes sont donc **signées en base**.
        const signed = native
            ? applyEffectSign(
                  native,
                  isNegativeNativeEffect(stat.effectId, {
                      negativeEffectIds: referential.negativeEffectIds,
                  })
              )
            : null;
        // La plage native est une SOURCE SERVEUR : le client ne la fixe jamais.
        const naturalMin = signed ? signed.from : null;
        const naturalMax = signed ? signed.to : null;
        const origin = signed ? stat.origin : "EXO";
        // Correction 13/09 (2ᵉ passe) — libellé : **table d'infobulle**
        // (`resolveStatLabel`, vérifiée contre les gabarits FR de DofusDB) →
        // référentiel siphonné → libellé déclaré. L'ordre est porté **une seule
        // fois** par `resolveStatLabel` (fin des cascades recopiées).
        const label =
            resolveStatLabel(
                { effectId: stat.effectId, characteristic: stat.characteristic ?? null },
                referential.effectLabels[stat.effectId] ??
                    (stat.characteristic != null
                        ? referential.labels[stat.characteristic]
                        : null)
            ) ??
            (!isPlaceholderStatLabel(stat.label) ? stat.label : null) ??
            stat.label;
        return {
            effectId: stat.effectId,
            characteristic: stat.characteristic ?? null,
            label,
            naturalMin,
            naturalMax,
            actualValue: stat.actualValue,
            origin,
            quality: computeStatQuality({
                naturalMin,
                naturalMax,
                actualValue: stat.actualValue,
                origin,
            }),
        };
    });

    /**
     * Constat beta — une ligne native `0 → 0` (« Échangeable : », « Compatible
     * avec : »…) n'est **pas un jet** : elle n'est jamais persistée. Le filtre
     * est aussi le **garde-fou** qui rend un cosmétique publiable : un brouillon
     * ancien (ou un client périmé) qui transmet encore ces lignes ne déclenche
     * plus « aucune statistique ne peut être déclarée » — la garde de famille
     * ne compte que des lignes **porteuses d'une valeur**.
     */
    const rows = mapped.filter(isStatBearingStatRow);
    if (rows.length === 0) return { rows: [], hash: null };

    return { rows, hash: computeStatsHash(rows) };
}

/** Réexport utilitaire : normalisation partagée fiche/catalogue (S7.4). */
export { normalizeNativeRange, resolveStoredStatLabel };
