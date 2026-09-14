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
import { formatKamas, formatGroupedInteger } from "@/lib/market/kamas";
import { normalizeItemIconUrl } from "@/lib/market/item-image";
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
     * Constat beta — **quantité du lot** et **minimum par acheteur** : affichés
     * dans la carte d'item depuis la suppression de la carte « Le lot / l'objet »
     * (qui les dupliquait).
     */
    quantity?: number | null;
    minQuantity?: number | null;
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
    /**
     * 📐 BUG-3 + constat beta : une annonce de **lot** n'a pas d'`itemIconUrl`,
     * la carte restait donc sur un cube gris. Repli : l'icône du **premier
     * composant** du lot, normalisée vers le proxy auto-siphon (jamais 404).
     */
    const itemIconUrl =
        normalizeItemIconUrl(data.iconUrl ?? null, null) ??
        normalizeItemIconUrl(components[0]?.iconUrl ?? null, null);
    // S8.4 — bloc STATUT : le mapping carte → lignes est **pur et testé**
    // (`describeSmithmagicStatus`) ; ce composant ne fait que le rendre.
    const statusLines: SmithmagicStatusLine[] = describeSmithmagicStatus({
        transcended: data.transcended,
        transcendenceLabel: data.transcendenceLabel,
        strikeElement: data.strikeElement,
        huntingWeapon: data.huntingWeapon,
    });

    /**
     * Constat beta (14/09) — « espace vide énorme » et « texte en tout petit »
     * sur la fiche d'un lot : quand l'annonce ne porte **aucun jet** (lot,
     * cosmétique, vente brute), la colonne d'effets est vide et la grande
     * vignette ne fait que creuser du blanc. On passe alors en présentation
     * **compacte** : vignette 64 px **à gauche, collée au texte**, contenus du lot
     * et quantités dans la même colonne, textes agrandis, marges serrées.
     * Un équipement **avec jet déclaré** garde la composition « tooltip Dofus ».
     */
    const compact = stats.length === 0;

    return (
        <div
            className={cn(
                "rounded-2xl border border-border-strong bg-elevated/80 p-5 shadow-inner",
                className
            )}
        >
            {/* 2 — Image · Nom · niveau/type · panoplie
                Constat beta (14/09) — la vignette est **dans le DOM en premier** :
                en présentation compacte elle est à **gauche**, collée au texte
                (fini le « vide immense au milieu » d'une icône isolée à droite) ;
                en composition « tooltip Dofus » (objet **avec jet**) la ligne est
                inversée (`flex-row-reverse`) pour garder l'objet à droite, comme
                la tooltip du jeu. */}
            <div
                className={cn(
                    "flex gap-4",
                    compact ? "flex-row items-start" : "flex-row-reverse items-start"
                )}
            >
                <div
                    className={cn(
                        "relative shrink-0 border border-border-strong bg-background/60",
                        compact ? "h-16 w-16 rounded-xl" : "h-28 w-28 rounded-2xl"
                    )}
                >
                    {itemIconUrl ? (
                        <Image
                            src={itemIconUrl}
                            alt={data.name}
                            fill
                            sizes={compact ? "64px" : "112px"}
                            className={compact ? "object-contain p-1" : "object-contain p-2"}
                            unoptimized
                        />
                    ) : (
                        <Package
                            className={cn(
                                "absolute inset-0 m-auto text-muted-foreground/40",
                                compact ? "h-8 w-8" : "h-12 w-12"
                            )}
                        />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3
                        className={cn(
                            "font-black text-foreground truncate",
                            compact ? "text-title" : "text-body"
                        )}
                    >
                        {data.name}
                    </h3>
                    <p
                        className={cn(
                            "text-muted-foreground mt-0.5",
                            compact ? "text-body-sm" : "text-caption"
                        )}
                    >
                        {data.level ? `Niveau ${data.level}` : ""}
                        {data.level && data.typeName ? " • " : ""}
                        {data.typeName ?? ""}
                    </p>
                    {data.itemSetName && (
                        <p className={cn("font-bold text-gold mt-1", compact ? "text-body-sm" : "text-label")}>
                            {data.itemSetName}
                        </p>
                    )}
                    {components.length > 0 && (
                        <div className={cn(compact ? "mt-2" : "mt-4")}>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                                Contenu du lot
                            </p>
                            <ul className="mt-1 space-y-0.5">
                                {components.map((component, index) => (
                                    <li
                                        key={index}
                                        className={cn(
                                            "flex items-center gap-2 text-foreground/90",
                                            compact ? "text-body" : "text-label"
                                        )}
                                    >
                                        <span className="font-black tabular-nums text-gold">
                                            ×{formatGroupedInteger(component.quantity)}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">{component.name}</span>
                                        {component.unitLabel && (
                                            <span className="text-caption text-muted-foreground">
                                                {component.unitLabel}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {(data.quantity != null || data.minQuantity != null) && (
                        <div
                            className={cn(
                                "mt-2 space-y-0.5 text-muted-foreground",
                                compact ? "text-body-sm" : "text-caption"
                            )}
                        >
                            {data.quantity != null && (
                                <p>
                                    Quantité du lot :{" "}
                                    <span className="font-bold tabular-nums text-foreground">
                                        {formatGroupedInteger(data.quantity)}
                                    </span>
                                    {data.unitLabel ? ` ${data.unitLabel}` : ""}
                                </p>
                            )}
                            {data.minQuantity != null && (
                                <p>
                                    Minimum par acheteur :{" "}
                                    <span className="font-bold tabular-nums text-foreground">
                                        {formatGroupedInteger(data.minQuantity)}
                                    </span>
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 9 — Variante légendaire / familier */}
            {data.isLegendary && (
                <div className="mt-3 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5 text-label font-bold text-gold">
                    Objet légendaire
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

            {/* Contenu du lot (ressources) — **seulement** hors présentation
                compacte : en compact, il vit dans la colonne de droite, collé à la
                vignette (constat beta « vide immense au milieu »). */}
            {!compact && components.length > 0 && (
                <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        Contenu du lot
                    </p>
                    <ul className="mt-2 space-y-1">
                        {components.map((component, index) => (
                            <li
                                key={index}
                                className={cn(
                                    "flex items-center gap-2 text-foreground/90",
                                    compact ? "text-body-sm" : "text-label"
                                )}
                            >
                                <span className="font-black tabular-nums text-gold">
                                    {/* BUG-9 — formatage déterministe (pas de `toLocaleString`) :
                                        le rendu serveur et l'hydratation produisent la même chaîne. */}
                                    ×{formatGroupedInteger(component.quantity)}
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

            {/* Constat beta — quantité du lot & minimum par acheteur (hors compact :
                déjà rendus dans la colonne de la vignette). */}
            {!compact && (data.quantity != null || data.minQuantity != null) && (
                <div className="mt-3 space-y-0.5 text-caption text-muted-foreground">
                    {data.quantity != null && (
                        <p>
                            Quantité du lot :{" "}
                            <span className="font-bold tabular-nums text-foreground">
                                {formatGroupedInteger(data.quantity)}
                            </span>
                            {data.unitLabel ? ` ${data.unitLabel}` : ""}
                        </p>
                    )}
                    {data.minQuantity != null && (
                        <p>
                            Minimum par acheteur :{" "}
                            <span className="font-bold tabular-nums text-foreground">
                                {formatGroupedInteger(data.minQuantity)}
                            </span>
                        </p>
                    )}
                </div>
            )}

            {/* 6 — Séparateur ornemental */}
            <div className={cn("h-px bg-gradient-to-r from-transparent via-border-strong to-transparent", compact ? "my-3" : "my-4")} />

            {/* 7 — Pied : pods · prix moyen · prix */}
            <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", compact ? "text-body-sm" : "text-caption")}>
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

            {/* 8 — Description : **retirée** (constat beta du 14/09/2026 — « supprime
                les textes un peu de lore/histoire des équipements, c'est inutile »).
                Le champ reste dans le contrat (l'assistant le transmet encore) mais
                n'est **jamais** rendu : la carte d'annonce montre la **vérité de
                l'objet** (nom, jet, forge, prix), pas son texte de catalogue. */}
        </div>
    );
}

