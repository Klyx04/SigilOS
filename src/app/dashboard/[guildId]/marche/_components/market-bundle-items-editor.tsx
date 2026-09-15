"use client";

/**
 * 🧺 Marché — édition d'un **lot multiple** (décision user du 14/09/2026).
 *
 * Bloc **autonome** (aucun état global, aucune I/O) : il édite la liste d'objets
 * et **le prix de chaque objet**, en refusant l'invalide via `bundleItemsSchema`
 * — la **même** règle que le serveur (§13.4 : zéro duplication).
 *
 * Additif : `market-create-client.tsx` l'importe à l'étape 2 quand la nature
 * vaut `BUNDLE` (props `items` + `onChange` uniquement).
 *
 * Règles visibles : **2 à 5 objets** · prix **par objet** (jamais global) · prix
 * à l'unité affiché pour comparer · total recalculé en direct (le serveur reste
 * la source de vérité, il rejoue `computeBundleTotal`).
 */

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { AlertCircle, Package, Plus, Trash2 } from "lucide-react";

import {
    MARKET_BUNDLE_MAX_ITEMS,
    MARKET_BUNDLE_MIN_ITEMS,
    bundleItemsSchema,
    computeBundleTotal,
    computeItemUnitPrice,
    type BundleItemInput,
} from "@/lib/market/bundle";
import { KamasAmount } from "@/components/market/kamas-amount";

/** Objet vide d'un nouveau lot (prix à 1 kama : à corriger par le vendeur). */
export function emptyBundleItem(): BundleItemInput {
    return { name: "", quantity: 1, unitLabel: null, priceKamas: 1 };
}

interface MarketBundleItemsEditorProps {
    items: BundleItemInput[];
    onChange: (items: BundleItemInput[]) => void;
    /** Objet suggéré par le catalogue (facultatif) : préremplit la 1ʳᵉ ligne. */
    suggested?: Partial<BundleItemInput> | null;
    /**
     * 🧺 Recherche dans le catalogue **par ligne** (facultatif).
     *
     * Le parent fournit le sélecteur (il connaît le catalogue local) ; une
     * **instance par objet** garantit que chaque ligne cherche indépendamment —
     * l'utilisateur doit pouvoir trouver **n'importe quoi**, ligne par ligne.
     */
    renderPicker?: (
        index: number,
        onPick: (item: { ankamaId: number; name: string; iconUrl?: string | null }) => void
    ) => ReactNode;
    disabled?: boolean;
}

export function MarketBundleItemsEditor({
    items,
    onChange,
    suggested,
    renderPicker,
    disabled = false,
}: MarketBundleItemsEditorProps) {
    const [touched, setTouched] = useState(false);
    const parsed = bundleItemsSchema.safeParse(items);
    const total = computeBundleTotal(items);

    const update = (index: number, patch: Partial<BundleItemInput>) => {
        onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
    };

    const addItem = () => {
        if (items.length >= MARKET_BUNDLE_MAX_ITEMS) return;
        const base = emptyBundleItem();
        onChange([
            ...items,
            items.length === 0 && suggested ? { ...base, ...suggested } : base,
        ]);
    };

    const removeItem = (index: number) => {
        if (items.length <= MARKET_BUNDLE_MIN_ITEMS) return;
        onChange(items.filter((_, position) => position !== index));
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Package className="h-4 w-4 text-gold" />
                    Objets du lot
                    <span className="text-xs font-normal text-muted-foreground">
                        ({items.length}/{MARKET_BUNDLE_MAX_ITEMS} — {MARKET_BUNDLE_MIN_ITEMS} minimum)
                    </span>
                </div>
                <button
                    type="button"
                    onClick={addItem}
                    disabled={disabled || items.length >= MARKET_BUNDLE_MAX_ITEMS}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter un objet
                </button>
            </div>

            <ul className="space-y-2">
                {items.map((item, index) => {
                    const unit = computeItemUnitPrice(item.priceKamas, item.quantity);
                    return (
                        <li key={index} className="space-y-2 rounded-lg border border-border bg-card/50 p-3">
                            <div className="flex items-start gap-2">
                                <span className="mt-2.5 w-4 text-xs text-muted-foreground">{index + 1}</span>
                                <div className="min-w-0 flex-1">
                                    {item.name.trim().length > 0 ? (
                                        <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-2">
                                            {item.iconUrl ? (
                                                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-background/70">
                                                    <Image
                                                        src={item.iconUrl}
                                                        alt=""
                                                        fill
                                                        sizes="40px"
                                                        className="object-contain p-0.5"
                                                        unoptimized
                                                    />
                                                </span>
                                            ) : null}
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                                {item.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    update(index, {
                                                        name: "",
                                                        dofusDbItemId: null,
                                                        iconUrl: null,
                                                    })
                                                }
                                                disabled={disabled}
                                                className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                                            >
                                                Changer
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground">
                                                Cherche l&apos;objet dans le catalogue : son nom et son
                                                icône sont repris tels quels (rien à saisir à la main).
                                            </p>
                                            {renderPicker?.(index, (picked) =>
                                                update(index, {
                                                    dofusDbItemId: picked.ankamaId,
                                                    name: picked.name,
                                                    iconUrl: picked.iconUrl ?? null,
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    disabled={disabled || items.length <= MARKET_BUNDLE_MIN_ITEMS}
                                    title={
                                        items.length <= MARKET_BUNDLE_MIN_ITEMS
                                            ? `Un lot contient au moins ${MARKET_BUNDLE_MIN_ITEMS} objets`
                                            : "Retirer cet objet"
                                    }
                                    className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="space-y-1 text-xs text-muted-foreground">
                                    Quantité
                                    <input
                                        type="number"
                                        min={1}
                                        value={item.quantity}
                                        onChange={(event) =>
                                            update(index, { quantity: Number(event.target.value) || 1 })
                                        }
                                        disabled={disabled}
                                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/50"
                                    />
                                </label>
                                <label className="space-y-1 text-xs text-muted-foreground">
                                    Prix de cet objet (kamas)
                                    <input
                                        type="number"
                                        min={1}
                                        value={item.priceKamas}
                                        onChange={(event) =>
                                            update(index, { priceKamas: Number(event.target.value) || 0 })
                                        }
                                        onBlur={() => setTouched(true)}
                                        disabled={disabled}
                                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/50"
                                    />
                                </label>
                            </div>

                            {unit !== null && item.quantity > 1 && (
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    Soit <KamasAmount value={unit} /> l&apos;unité.
                                </p>
                            )}
                        </li>
                    );
                })}
            </ul>

            {touched && !parsed.success && (
                <p className="flex items-start gap-1.5 text-xs text-danger">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {parsed.error.issues[0]?.message ?? "Lot invalide."}
                </p>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total du lot (recalculé côté serveur)</span>
                <span className="font-semibold text-foreground">
                    <KamasAmount value={total} />
                </span>
            </div>
        </div>
    );
}

