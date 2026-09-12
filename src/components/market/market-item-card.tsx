"use client";

/**
 * Module « Marché » — **carte d'item** (§12.3/§12.4, S2.14).
 *
 * Composant partagé unique pour la fiche de l'annonce **et** l'aperçu en direct
 * de l'éditeur. Anatomie exacte : nom · niveau/type · panoplie · image · effets
 * (icône + valeur + libellé + plage) · « Modifié par » · pods · prix moyen ·
 * description. Les couleurs suivent la charte (§12.4) via des **tokens**.
 */

import Image from "next/image";
import { Package, Scale, Sparkles, Sword, Target } from "lucide-react";
import { StatIcon } from "@/components/market/stat-icon";
import { formatKamas } from "@/lib/market/kamas";
import { isPercentStat, normalizeNativeRange } from "@/lib/market/effects";
import {
    describeSmithmagicStatus,
    type SmithmagicStatusKind,
    type SmithmagicStatusLine,
} from "@/lib/market/smithmagic";
import { cn } from "@/lib/utils";

export type MarketItemCardStat = {
    effectId: number;
    characteristic: number | null;
    label: string;
    actualValue: number;
    naturalMin: number | null;
    naturalMax: number | null;
    origin: string;
    quality: string;
};

export type MarketItemCardComponent = {
    name: string;
    quantity: number;
    unitLabel?: string | null;
    iconUrl?: string | null;
};

export type MarketItemCardData = {
    name: string;
    level?: number | null;
    typeName?: string | null;
    itemSetName?: string | null;
    iconUrl?: string | null;
    isLegendary?: boolean;
    description?: string | null;
    forgedBy?: string | null;
    realWeight?: number | null;
    averagePrice?: number | null;
    priceKamas?: number | null;
    unitLabel?: string | null;
    /**
     * S8.4 (D40) — **forge réelle**. Ces informations sont **déclarées** par le
     * vendeur (jamais déduites du jet) et alimentent le **bloc STATUT** :
     * - `transcended` : l'objet porte une rune de Transcendance ;
     * - `transcendenceLabel` : libellé affiché (repli :
     *   « Empêche les futures forgemagies ») ;
     * - `strikeElement` : élément de frappe fixé par une potion de forgemagie ;
     * - `huntingWeapon` : libellé de l'arme de chasse.
     */
    transcended?: boolean;
    transcendenceLabel?: string | null;
    strikeElement?: string | null;
    huntingWeapon?: string | null;
    stats?: MarketItemCardStat[];
    components?: MarketItemCardComponent[];
};

/** Couleur d'une valeur selon sa qualité/origine (§12.4). */
function statValueClass(stat: MarketItemCardStat): string {
    if (stat.origin === "EXO") return "text-info";
    if ([1, 23, 19].includes(stat.characteristic ?? -1)) return "text-info"; // PA / PM / PO
    switch (stat.quality) {
        case "PERFECT":
            return "text-foreground font-black";
        case "OVER":
            return "text-info font-bold";
        case "GOOD":
            return "text-success";
        case "LOW":
            return "text-warning";
        default:
            return stat.actualValue < 0 ? "text-danger" : "text-muted-foreground";
    }
}

function formatStatLineValue(stat: MarketItemCardStat): string {
    const sign = stat.actualValue >= 0 ? "+" : "";
    return `${sign}${stat.actualValue}${isPercentStat(stat.label) ? " %" : ""}`;
}

function formatRange(stat: MarketItemCardStat): string {
    const { naturalMin, naturalMax } = stat;
    if (naturalMin == null && naturalMax == null) return `[${stat.actualValue}]`;
    // S7.6 — même règle que le serveur (`normalizeNativeRange`, S7.4) : une valeur
    // fixe s'affiche entre crochets simples, jamais `[10 à 0]`.
    const { from, to } = normalizeNativeRange(
        naturalMin ?? naturalMax ?? 0,
        naturalMax ?? naturalMin ?? 0
    );
    if (naturalMin == null) return `[${to}]`;
    if (naturalMax == null) return `[${from}]`;
    return from === to ? `[${from}]` : `[${from} à ${to}]`;
}

/**
 * S8.4 — icône d'une ligne du bloc STATUT (`lucide-react`, charte §12.4).
 */
function StatusLineIcon({ kind }: { kind: SmithmagicStatusKind }) {
    if (kind === "TRANSCENDED") return <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" />;
    if (kind === "STRIKE_ELEMENT") return <Sword className="h-3.5 w-3.5 shrink-0 text-info" />;
    return <Target className="h-3.5 w-3.5 shrink-0 text-success" />;
}

export function MarketItemCard({ data, className }: { data: MarketItemCardData; className?: string }) {
    const stats = data.stats ?? [];
    const components = data.components ?? [];
    // S8.4 — bloc STATUT : le mapping carte → lignes est **pur et testé**
    // (`describeSmithmagicStatus`) ; ce composant ne fait que le rendre.
    const statusLines: SmithmagicStatusLine[] = describeSmithmagicStatus({
        transcended: data.transcended,
        transcendenceLabel: data.transcendenceLabel,
        strikeElement: data.strikeElement,
        huntingWeapon: data.huntingWeapon,
    });

    return (
        <div
            className={cn(
                "rounded-2xl border border-border-strong bg-elevated/80 p-5 shadow-inner",
                className
            )}
        >
            {/* 2 — Nom · niveau/type · panoplie · image */}
            <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <h3 className="text-body font-black text-foreground truncate">{data.name}</h3>
                    <p className="text-caption text-muted-foreground mt-0.5">
                        {data.level ? `Niveau ${data.level}` : ""}
                        {data.level && data.typeName ? " • " : ""}
                        {data.typeName ?? ""}
                    </p>
                    {data.itemSetName && (
                        <p className="text-label font-bold text-gold mt-1">{data.itemSetName}</p>
                    )}
                </div>
                <div className="relative h-16 w-16 shrink-0 rounded-xl border border-border bg-background/60">
                    {data.iconUrl ? (
                        <Image
                            src={data.iconUrl}
                            alt={data.name}
                            fill
                            sizes="64px"
                            className="object-contain p-1"
                            unoptimized
                        />
                    ) : (
                        <Package className="absolute inset-0 m-auto h-7 w-7 text-muted-foreground/40" />
                    )}
                </div>
            </div>

            {/* 9 — Variante légendaire / familier */}
            {data.isLegendary && (
                <div className="mt-3 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5 text-label font-bold text-gold">
                    Statut légendaire
                </div>
            )}

            {/* 9bis — S8.4 : bloc STATUT de forge réelle (D40), juste avant EFFETS */}
            {statusLines.length > 0 && (
                <div className="mt-3 rounded-xl border border-border-strong bg-elevated/60 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        Statut
                    </p>
                    <ul className="mt-1 space-y-1">
                        {statusLines.map((line) => (
                            <li key={line.kind} className="flex items-center gap-2 text-label">
                                <StatusLineIcon kind={line.kind} />
                                <span className="min-w-0 flex-1 truncate text-foreground/90">
                                    {line.label}
                                </span>
                                {line.value && (
                                    <span className="shrink-0 font-bold tabular-nums text-gold">
                                        {line.value}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 3 — Bandeau EFFETS */}
            {stats.length > 0 && (
                <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        Effets
                    </p>
                    <ul className="mt-2 space-y-1">
                        {stats.map((stat) => (
                            <li
                                key={`${stat.effectId}-${stat.origin}`}
                                className="flex items-center gap-2 text-label"
                            >
                                <StatIcon
                                    characteristicId={stat.characteristic}
                                    effectId={stat.effectId}
                                    label={stat.label}
                                />
                                <span className={cn("tabular-nums font-bold", statValueClass(stat))}>
                                    {formatStatLineValue(stat)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-foreground/90">
                                    {stat.label}
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {formatRange(stat)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}


            {/* 5 — Modifié par */}
            {data.forgedBy && (
                <p className="mt-3 text-label font-bold text-gold">Modifié par : {data.forgedBy}</p>
            )}

            {/* Contenu du lot (ressources) */}
            {components.length > 0 && (
                <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        Contenu du lot
                    </p>
                    <ul className="mt-2 space-y-1">
                        {components.map((component, index) => (
                            <li key={index} className="flex items-center gap-2 text-label text-foreground/90">
                                <span className="font-black tabular-nums text-gold">
                                    ×{component.quantity.toLocaleString("fr-FR")}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{component.name}</span>
                                {component.unitLabel && (
                                    <span className="text-caption text-muted-foreground">{component.unitLabel}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 6 — Séparateur ornemental */}
            <div className="my-4 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />

            {/* 7 — Pied : pods · prix moyen · prix */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                    POIDS
                    <span className="font-bold tabular-nums text-foreground">
                        {data.realWeight != null ? data.realWeight : "—"}
                    </span>
                </span>
                {data.averagePrice != null && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        PRIX MOYEN
                        <span className="font-bold tabular-nums text-gold">
                            {formatKamas(data.averagePrice)}
                        </span>
                    </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    PRIX
                    <span className="font-black tabular-nums text-gold">{formatKamas(data.priceKamas ?? null)}</span>
                    {data.unitLabel ? <span className="text-caption">{data.unitLabel}</span> : null}
                </span>
            </div>

            {/* 8 — Description */}
            {data.description && (
                <p className="mt-3 text-caption italic text-muted-foreground">{data.description}</p>
            )}
        </div>
    );
}

