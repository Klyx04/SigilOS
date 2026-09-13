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
import { normalizeNativeRange } from "@/lib/market/effects";
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
    if (stats.length === 0) return null;

    return (
        <ul className={cn("space-y-1", className)}>
            {stats.map((stat) => (
                <li key={stat.id} className="flex items-center gap-2 text-xs">
                    <StatIcon
                        characteristicId={stat.characteristic}
                        effectId={stat.effectId}
                        label={stat.label}
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground/90">{stat.label}</span>
                    <span className="shrink-0 font-bold tabular-nums text-foreground">
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
