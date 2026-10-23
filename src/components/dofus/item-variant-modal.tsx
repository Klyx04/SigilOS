"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, X, RotateCcw, Sparkles } from "lucide-react";
import { searchVariantItems, type VariantItemSummary } from "@/server/actions/dofus-variants-actions";
import {
    VARIANT_STAT_FILTERS,
    VARIANT_SLOTS,
    type StatFilterOption,
} from "@/lib/dofus-variant-utils";
import type { DofusbookItem } from "@/lib/dofusbook-utils";
import { resolveDofusStatTheme, dofusStatAssetUrl } from "@/lib/dofus-stats-theme";
import { getPassiveDescription } from "@/lib/dofus-passives";
import { cn } from "@/lib/utils";

interface ItemVariantModalProps {
    slot: string | null;
    currentVariant?: DofusbookItem | null;
    originalItem?: DofusbookItem | null;
    buildLevel?: number;
    onSelect: (slot: string, item: DofusbookItem) => void;
    onRemoveVariant: (slot: string) => void;
    onClose: () => void;
}

export function ItemVariantModal({
    slot,
    currentVariant,
    originalItem,
    buildLevel = 200,
    onSelect,
    onRemoveVariant,
    onClose,
}: ItemVariantModalProps) {
    const [query, setQuery] = useState("");
    const [minLevel, setMinLevel] = useState(1);
    const [maxLevel, setMaxLevel] = useState(buildLevel || 200);
    const [selectedStats, setSelectedStats] = useState<string[]>([]);
    const [items, setItems] = useState<VariantItemSummary[]>([]);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const slotInfo = slot ? VARIANT_SLOTS[slot] : null;
    const slotName = slotInfo?.slotName || "Équipement";

    // Réinitialise les filtres à l'ouverture d'un nouveau slot
    useEffect(() => {
        if (!slot) return;
        setQuery("");
        setMinLevel(1);
        setMaxLevel(buildLevel || 200);
        setSelectedStats([]);
    }, [slot, buildLevel]);

    // Recherche réactive
    useEffect(() => {
        if (!slot) return;

        let cancelled = false;
        startTransition(async () => {
            const res = await searchVariantItems({
                slot,
                query,
                minLevel,
                maxLevel,
                statFilters: selectedStats,
                limit: 48,
            });

            if (cancelled) return;
            if (res.success && res.data) {
                setItems(res.data.items);
                setError(null);
            } else {
                setError(res.error || "Impossible de charger les équipements.");
            }
        });

        return () => {
            cancelled = true;
        };
    }, [slot, query, minLevel, maxLevel, selectedStats]);

    const toggleStatFilter = (statCode: string) => {
        setSelectedStats((prev) =>
            prev.includes(statCode) ? prev.filter((c) => c !== statCode) : [...prev, statCode]
        );
    };

    const handleSelectItem = (item: VariantItemSummary) => {
        if (!slot) return;
        const dofusbookItem: DofusbookItem = {
            id: item.ankamaId,
            name: item.name,
            picture: item.ankamaId,
            official: item.ankamaId,
            level: item.level,
            typeName: item.typeName,
            effects: item.stats.map((s) => ({
                code: s.code,
                min: s.min,
                max: s.max,
                value: s.value,
            })),
        };
        onSelect(slot, dofusbookItem);
        onClose();
    };

    if (!slot) return null;

    return (
        <Dialog open={!!slot} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-w-[1400px] w-[95vw] h-[92vh] max-h-[92vh] bg-background border-border p-0 flex flex-col overflow-hidden rounded-[8px] shadow-2xl"
                showCloseButton={false}
            >
                {/* ─── EN-TÊTE ────────────────────────────────────────── */}
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface/80 px-5 py-3.5 backdrop-blur-md">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-warning" />
                        </div>
                        <DialogTitle className="text-base font-extrabold uppercase tracking-tight text-foreground flex items-center gap-2">
                            <span>Variante :</span>
                            <span className="text-success">{slotName}</span>
                            {currentVariant && (
                                <span className="ml-2 px-2 py-0.5 rounded bg-warning/15 border border-warning/30 text-[10px] font-bold text-warning normal-case">
                                    Active : {currentVariant.name}
                                </span>
                            )}
                        </DialogTitle>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentVariant && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    onRemoveVariant(slot);
                                    onClose();
                                }}
                                className="h-8 gap-1.5 text-xs font-bold text-muted-foreground hover:text-danger hover:border-danger/30"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Retirer la variante ({originalItem?.name || "Objet de base"})
                            </Button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ─── BARRE D'OUTILS DE RECHERCHE & NIVEAUX ───────────── */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/40 px-5 py-2.5">
                    {/* Recherche textuelle */}
                    <div className="relative flex-1 min-w-[240px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Tape le nom pour ${slotName.toLowerCase()}…`}
                            className="pl-9 h-9 bg-background border-border text-xs font-medium rounded-lg"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtres de niveau */}
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <span>Niv. min :</span>
                        <Input
                            type="number"
                            min={1}
                            max={200}
                            value={minLevel}
                            onChange={(e) => setMinLevel(Math.max(1, Number(e.target.value) || 1))}
                            className="w-16 h-8 text-center text-xs bg-background border-border"
                        />
                        <span>Niv. max :</span>
                        <Input
                            type="number"
                            min={1}
                            max={200}
                            value={maxLevel}
                            onChange={(e) => setMaxLevel(Math.min(200, Number(e.target.value) || 200))}
                            className="w-16 h-8 text-center text-xs bg-background border-border"
                        />
                        {selectedStats.length > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedStats([])}
                                className="h-8 text-xs font-bold text-danger hover:bg-danger/10 ml-2"
                            >
                                Effacer les stats ({selectedStats.length})
                            </Button>
                        )}
                    </div>
                </div>

                {/* ─── CORPS PRINCIPAL : GRILLE ITEMS (GAUCHE) & STATS (DROITE) ─ */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Zone d'affichage des items */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {isPending && items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-28 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-success" />
                                <p className="text-sm font-bold text-muted-foreground">
                                    Recherche des équipements dans le grimoire…
                                </p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                                <p className="text-base font-extrabold text-foreground">
                                    Aucun équipement trouvé
                                </p>
                                <p className="text-xs text-muted-foreground max-w-sm">
                                    Essaie d'ajuster le niveau maximum, le filtre de nom ou de retirer certains filtres de caractéristiques.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                {items.map((item) => {
                                    const isCurrent = currentVariant?.id === item.ankamaId;
                                    const isOriginal = originalItem?.id === item.ankamaId;

                                    return (
                                        <button
                                            key={item.ankamaId}
                                            type="button"
                                            onClick={() => handleSelectItem(item)}
                                            className={cn(
                                                "flex flex-col rounded-xl border p-3.5 text-left transition-all hover:scale-[1.01] hover:shadow-lg cursor-pointer group bg-surface/60",
                                                isCurrent
                                                    ? "border-warning bg-warning/5 ring-1 ring-warning"
                                                    : isOriginal
                                                      ? "border-info/40 bg-info/5"
                                                      : "border-border hover:border-border-strong hover:bg-elevated"
                                            )}
                                        >
                                            {/* Header carte : icône + nom + niveau */}
                                            <div className="flex flex-col items-center text-center gap-1.5 pb-2.5 border-b border-border/40">
                                                <div className="w-14 h-14 rounded-lg bg-background/80 border border-border/60 flex items-center justify-center p-1 group-hover:scale-105 transition-transform">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={`/api/assets-dofus/items/${item.ankamaId}`}
                                                        alt={item.name}
                                                        className="w-12 h-12 object-contain"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            (e.target as HTMLElement).style.opacity = "0.5";
                                                        }}
                                                    />
                                                </div>
                                                <h4 className="font-extrabold text-xs text-foreground group-hover:text-success transition-colors line-clamp-1">
                                                    {item.name}
                                                </h4>
                                                {item.itemSetName && (
                                                    <p className="text-[10px] font-bold text-success/90 line-clamp-1">
                                                        {item.itemSetName}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase">
                                                    <span>Niv. {item.level} ★</span>
                                                    {isCurrent && (
                                                        <span className="text-warning font-bold">(Actif)</span>
                                                    )}
                                                    {isOriginal && (
                                                        <span className="text-info font-bold">(Base)</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Effets & Caractéristiques de l'item */}
                                            <div className="flex-1 flex flex-col gap-1 pt-2.5 text-[11px] leading-tight">
                                                {(() => {
                                                    const passiveDesc = getPassiveDescription(item.name);
                                                    const regularStats = item.stats.filter((st) => st.code !== "sp");

                                                    return (
                                                        <>
                                                            {passiveDesc && (
                                                                <div className="mb-1 p-2 rounded-lg bg-warning/10 border border-warning/25 text-[10px] text-foreground leading-snug">
                                                                    <span className="font-extrabold text-warning block mb-0.5">✦ Passif :</span>
                                                                    <p className="line-clamp-3">{passiveDesc}</p>
                                                                </div>
                                                            )}
                                                            {regularStats.map((st, idx) => {
                                                                const theme = resolveDofusStatTheme(null, null, st.code);
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className={cn(
                                                                            "flex items-center justify-between gap-1 py-0.5",
                                                                            st.isNegative
                                                                                ? "text-danger"
                                                                                : "text-foreground"
                                                                        )}
                                                                    >
                                                                        <span className="flex items-center gap-1.5 min-w-0">
                                                                            {theme?.asset && (
                                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                                <img
                                                                                    src={dofusStatAssetUrl(theme.asset)}
                                                                                    alt=""
                                                                                    className="w-3.5 h-3.5 object-contain shrink-0"
                                                                                    loading="lazy"
                                                                                />
                                                                            )}
                                                                            <span className="truncate text-muted-foreground">
                                                                                {st.label}
                                                                            </span>
                                                                        </span>
                                                                        <span className="font-black tabular-nums whitespace-nowrap ml-1">
                                                                            {st.value > 0 ? `+${st.value}` : st.value}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ─── COLONNE DROITE : FILTRES DE STATS (STYLE DUFFUS) ─ */}
                    <div className="w-56 shrink-0 border-l border-border bg-surface/50 p-3 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 text-xs">
                        <div className="pb-2 border-b border-border/60">
                            <h5 className="font-extrabold uppercase tracking-wider text-[11px] text-foreground">
                                Filtrer par stats
                            </h5>
                            <p className="text-[10px] text-muted-foreground">
                                Seuls les objets avec ces stats s'afficheront
                            </p>
                        </div>

                        {VARIANT_STAT_FILTERS.map((filter) => {
                            const isSelected = selectedStats.includes(filter.code);
                            const theme = resolveDofusStatTheme(null, null, filter.code);

                            return (
                                <button
                                    key={filter.code}
                                    type="button"
                                    onClick={() => toggleStatFilter(filter.code)}
                                    className={cn(
                                        "flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer font-bold text-[11px]",
                                        isSelected
                                            ? "bg-success/15 border-success text-success"
                                            : "bg-surface border-border/60 text-muted-foreground hover:bg-elevated hover:text-foreground hover:border-border"
                                    )}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        {filter.icon ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={filter.icon}
                                                alt=""
                                                className="w-3.5 h-3.5 object-contain shrink-0"
                                                loading="lazy"
                                            />
                                        ) : theme?.asset ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={dofusStatAssetUrl(theme.asset)}
                                                alt=""
                                                className="w-3.5 h-3.5 object-contain shrink-0"
                                                loading="lazy"
                                            />
                                        ) : null}
                                        <span className="truncate">{filter.label}</span>
                                    </span>
                                    {isSelected && <span className="text-[10px] font-black">✓</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
