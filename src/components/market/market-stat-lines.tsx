"use client";

/**
 * S8.15 — **lines de jet compactes** (icône officielle + libellé + valeur)
 * pour les écrans qui n'affichaient le jet qu'en **texte nu** : « Mon espace »,
 * la négociation et la modération.
 *
 * 🔒 Le composant est **purement présentationnel** : aucune règle métier, aucun
 * appel serveur, aucune action. Les icônes viennent de `StatIcon` (assets
 * **locaux** `/assets/dofus/…`, jamais une URL non whitelistée). Les libellés et
 * le **signe** sont ceux résolus **côté serveur** (`resolveStatLabel`, S8.24) :
 * l'UI n'invente rien.
 */

import { StatIcon } from "@/components/market/stat-icon";
import { isStatBearingStatRow, normalizeNativeRange } from "@/lib/market/effects";
import type { MarketStatLineView } from "@/server/actions/market-constants";
import { cn } from "@/lib/utils";

/** Ligne de jet déclarée telle que sérialisée par les server actions du marché. */
export type MarketStatLine = MarketStatLineView;

/** Valeur signée, jamais « +-3 ». */
function formatValue(stat: MarketStatLine): string {
    return `${stat.actualValue >= 0 ? "+" : ""}${stat.actualValue}`;
}

/**
 * Plage native lisible — **même normalisation que le serveur**
 * (`normalizeNativeRange`, S7.4) : jamais `[10 à 0]`, jamais `[null]`.
 */
function formatRange(stat: MarketStatLine): string {
    const { naturalMin, naturalMax } = stat;
    if (naturalMin == null && naturalMax == null) return "";
    const { from, to } = normalizeNativeRange(
        naturalMin ?? naturalMax ?? 0,
        naturalMax ?? naturalMin ?? 0
    );
    if (naturalMin == null) return `[${to}]`;
    if (naturalMax == null) return `[${from}]`;
    return from === to ? `[${from}]` : `[${from} à ${to}]`;
}

export function MarketStatLines({
    stats,
    className,
}: {
    stats: MarketStatLine[];
    className?: string;
}) {
    /**
     * Constat beta — les lignes de **métadonnées** (`0 → 0`, « Échangeable : »,
     * « Compatible avec : ») des annonces écrites avant la garde d'écriture ne
     * sont jamais rendues : « Mon espace », la négociation et la modération
     * n'affichent plus « +0 Échangeable : [0] ».
     */
    const lines = stats.filter(isStatBearingStatRow);
    if (lines.length === 0) return null;

    return (
        /*
         * 📐 Mise en page resserrée (constat beta du 13/09 : « trop de vide entre
         * le nom de l'objet et ses stats ») : le jet passe sur **deux colonnes**
         * dès `sm`, et la valeur/plage restent **collées au libellé** (plus de
         * `flex-1` qui poussait la valeur à l'autre bout de l'écran).
         */
        <ul
            className={cn(
                "grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2",
                className
            )}
        >
            {lines.map((stat) => (
                <li key={stat.id} className="flex min-w-0 items-center gap-2 text-xs">
                    <StatIcon
                        characteristicId={stat.characteristic}
                        effectId={stat.effectId}
                        label={stat.label}
                    />
                    <span className="truncate text-foreground/90">{stat.label}</span>
                    <span className="ml-auto shrink-0 font-bold tabular-nums text-foreground">
                        {formatValue(stat)}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatRange(stat)}
                    </span>
                    {stat.origin === "EXO" ? (
                        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-info">
                            Exo
                        </span>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}
