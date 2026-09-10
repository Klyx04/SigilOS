"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    Search, ExternalLink, Loader2, PackageOpen, Sword, Shield, Sparkles, Scroll,
    Zap, Heart, Brain, Droplet, Wind, Target, Eye, Footprints, Flame, Star, ShieldCheck, Plus,
    Library
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
    getStatLabel as sharedGetStatLabel,
    resolveStatIconSpec,
    type StatIconName,
} from "@/lib/market/effects";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DofusItemEffect {
    int_id?: number;
    effectId?: number;
    characteristic?: number;
    from: number;
    to: number;
    int_name?: string;
}

interface Ingredient {
    id: number;
    name: { fr: string };
    img?: string;
    imgset?: { icon: string }[];
}

interface DofusRecipe {
    job?: { name: { fr: string } };
    resultLevel?: number;
    ingredients: Ingredient[];
    quantities: number[];
}

interface DofusItem {
    id: number;
    name: { fr: string };
    level: number;
    type: { name: { fr: string } };
    description?: { fr: string };
    imgset?: { sd?: string; icon?: string }[];
    img?: string;
    effects?: DofusItemEffect[];
    possibleEffects?: DofusItemEffect[];
    is_recipe_item?: boolean;
    hasRecipe?: boolean;
    isSaleable?: boolean;
    itemSet?: {
        name: { fr: string };
        id: number;
    };
}

// ─── Constants & Helpers ───────────────────────────────────────────────────


/**
 * 🛡️ Résolution locale-first des images d'items.
 * -> /api/assets-dofus/items/{id} : proxy auto-siphon WebP (0 404, 0 appel externe visible)
 * Fallback : si l'id est inconnu, on passe l'URL distante telle quelle via le proxy générique.
 */
function getItemImageUrl(id?: number | string | null, fallbackUrl?: string | null): string {
    if (id) {
        const query = fallbackUrl ? `?url=${encodeURIComponent(fallbackUrl)}` : '';
        return `/api/assets-dofus/items/${id}${query}`;
    }
    return fallbackUrl || '';
}

const TYPE_COLORS: Record<string, string> = {
    "Arme": "#ef4444",
    "Équipement": "#a855f7",
    "Ressource": "#f59e0b",
    "Consommable": "#10b981",
    "Parchemin": "#3b82f6",
    "Quête": "#ec4899",
    "Familier": "#8b5cf6",
};

function getTypeColor(typeName: string): string {
    for (const [key, color] of Object.entries(TYPE_COLORS)) {
        if (typeName?.includes(key)) return color;
    }
    return "#818cf8";
}

/**
 * Mapping **slug d'icône partagé** → composant lucide.
 * Les slugs et les couleurs vivent désormais dans `src/lib/market/effects.ts`
 * (`STAT_ICON_SPECS`) : ce composant n'est qu'un **consommateur** (S2.4).
 */
const ICON_COMPONENTS: Record<StatIconName, any> = {
    heart: Heart,
    brain: Brain,
    droplet: Droplet,
    wind: Wind,
    flame: Flame,
    sword: Sword,
    zap: Zap,
    footprints: Footprints,
    target: Target,
    eye: Eye,
    star: Star,
    plus: Plus,
    shield: Shield,
    shieldCheck: ShieldCheck,
    sparkles: Sparkles,
    pkg: PackageOpen,
};

/**
 * Libellé FR d'un effet — **délégué** au module partagé (S2.4 / S2.5bis).
 * Les tables `CHAR_NAMES` / `BOOK_STAT_NAMES` vivent maintenant dans
 * `src/lib/market/effects.ts`, et le référentiel data-driven (base) est branché
 * côté serveur via `getStatLabel(fx, referential)`.
 */
function getStatLabel(fx: DofusItemEffect): string {
    return sharedGetStatLabel(fx);
}

function StatIcon({ characteristicId, charCode }: { characteristicId?: number, charCode?: string }) {
    const spec = resolveStatIconSpec(characteristicId, charCode);
    if (!spec) {
        return <div className="w-1.5 h-1.5 rounded-full bg-violet-500/40" />;
    }
    const Icon = ICON_COMPONENTS[spec.icon];
    return <Icon className={cn("h-3.5 w-3.5", spec.color)} />;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ItemSearchPanel() {
    // DofusDB States
    const [dbQuery, setDbQuery] = useState("");
    const [dbResults, setDbResults] = useState<DofusItem[]>([]);
    const [dbLoading, setDbLoading] = useState(false);


    // Common States
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [recipe, setRecipe] = useState<DofusRecipe | null>(null);
    const searchDB = useCallback(async (q: string) => {
        if (!q.trim() || q.trim().length < 2) {
            setDbResults([]);
            return;
        }
        setDbLoading(true);
        try {
            const res = await fetch(`/api/dofusdb/search?q=${encodeURIComponent(q.trim())}&limit=20`);
            if (res.ok) {
                const data = await res.json();
                setDbResults(Array.isArray(data.data) ? data.data : []);
            } else {
                setDbResults([]);
            }
        } catch {
            setDbResults([]);
        } finally {
            setDbLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (dbQuery.trim().length >= 2) searchDB(dbQuery);
            else if (dbQuery.trim().length === 0) setDbResults([]);
        }, 400);
        return () => clearTimeout(timer);
    }, [dbQuery, searchDB]);

    const handleSelectDB = async (item: DofusItem) => {
        setLoadingDetail(true);
        setRecipe(null);
        try {
            const res = await fetch(`/api/dofusdb/items/${item.id}`);
            if (res.ok) {
                const detailed = await res.json();
                if (detailed && !detailed.error) {
                    setSelectedItem(detailed);
                    if (detailed.hasRecipe || detailed.is_recipe_item) {
                        const recRes = await fetch(`/api/dofusdb/recipes/${item.id}`);
                        if (recRes.ok) {
                            const rec = await recRes.json();
                            if (rec && !rec.error) setRecipe(rec);
                        }
                    }
                } else {
                    setSelectedItem(item);
                }
            } else {
                setSelectedItem(item);
            }
        } catch {
            setSelectedItem(item);
        } finally {
            setLoadingDetail(false);
        }
    };

    return (
        <div className="w-full flex flex-col min-h-[600px] relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">

                {/* Sidebar Search */}
                <div className="lg:col-span-4 flex flex-col gap-8">

                    {/* DofusDB Block */}
                    <div className="rounded-2xl p-8 border border-border shadow-sm bg-surface flex flex-col transition-colors hover:border-violet-500/20">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 ">
                                <Search className="h-6 w-6 text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-label font-semibold text-foreground">DofusDB Nexus</h2>
                                <p className="text-caption text-muted-foreground font-medium mt-1">Global Quick Search</p>
                            </div>
                        </div>

                        <div className="relative mb-6">
                            <input
                                type="text"
                                value={dbQuery}
                                onChange={(e) => setDbQuery(e.target.value)}
                                placeholder="Rechercher un objet..."
                                className="w-full bg-background/60 border border-border rounded-2xl pl-12 pr-4 py-4 text-sm text-foreground outline-none focus:border-violet-500/50 focus:bg-background/80 transition-colors placeholder:text-muted-foreground shadow-inner"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        </div>

                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {dbLoading && <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" /></div>}
                            {dbResults.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectDB(item)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-3 rounded-2xl border transition-colors group",
                                        selectedItem?.id === item.id
                                            ? "bg-violet-500/10 border-violet-500/40 "
                                            : "bg-surface border-border hover:bg-surface hover:border-border"
                                    )}
                                >
                                    <div className="w-11 h-11 rounded-xl bg-background flex items-center justify-center border border-border shrink-0 group- transition-transform">
                                        <Image src={getItemImageUrl(item.id, item.imgset?.[0]?.icon || item.img)} alt={item.name.fr} width={32} height={32} className="object-contain" unoptimized />
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <div className="text-body-sm font-bold text-foreground group-hover:text-foreground truncate">{item.name.fr}</div>
                                        <div className="text-caption font-medium text-muted-foreground">Niv. {item.level}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Detail Panel */}
                <div className="lg:col-span-8">
                    <div className={cn(
                        "h-full min-h-[600px] rounded-[3rem] border backdrop-blur-3xl p-10 flex flex-col relative overflow-hidden transition-colors duration-300 shadow-sm",
                        "bg-surface border-border"
                    )}>
                        {!selectedItem ? (
                            <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-violet-500/20 blur-[100px] rounded-full group-hover:bg-success/20 transition-colors duration-300" />
                                    <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-violet-500/10 to-success/10 border border-border flex items-center justify-center relative z-10 shadow-sm group- transition-transform duration-300 backdrop-blur-xl">
                                        <Library className="h-10 w-10 text-foreground animate-pulse" />
                                    </div>
                                </div>

                                <div className="space-y-4 max-w-lg relative z-10">
                                    <h3 className="text-4xl font-semibold tracking-tighter text-foreground leading-none">
                                        Nexus <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-white to-success">Encyclopédique</span>
                                    </h3>
                                    <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                                        Votre archive centrale synchronisée. Recherchez n&apos;importe quel équipement, ressource ou dofus pour consulter ses statistiques et sa recette de craft en temps réel.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-8 relative z-10">
                                    <div className="p-6 rounded-xl bg-surface border border-border space-y-3 hover:border-violet-500/30 hover:bg-surface transition-colors group/card">
                                        <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-2 border border-violet-500/20 group-hover/card:scale-110 transition-transform">
                                            <Zap className="h-5 w-5 text-violet-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-label font-semibold text-foreground">Effets Directs</h4>
                                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-tight">Jets min/max & bonus</p>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-xl bg-surface border border-border space-y-3 hover:border-success/30 hover:bg-surface transition-colors group/card">
                                        <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-2 border border-success/20 group-hover/card:scale-110 transition-transform">
                                            <Scroll className="h-5 w-5 text-success" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-label font-semibold text-foreground">Fabrication</h4>
                                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-tight">Recettes & quantités</p>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-xl bg-surface border border-border space-y-3 hover:border-warning/30 hover:bg-surface transition-colors group/card">
                                        <div className="w-10 h-10 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-2 border border-warning/20 group-hover/card:scale-110 transition-transform">
                                            <ExternalLink className="h-5 w-5 text-warning" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-label font-semibold text-foreground">DofusDB</h4>
                                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-tight">Catalogue officiel</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-12 text-muted-foreground">
                                    <p className="text-caption font-semibold flex items-center gap-4 justify-center">
                                        <div className="w-12 h-px bg-current opacity-20" />
                                        Recherchez pour commencer
                                        <div className="w-12 h-px bg-current opacity-20" />
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col animate-in fade-in zoom-in-95 duration-300">
                                {loadingDetail && (
                                    <div className="absolute inset-0 bg-surface backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
                                        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row gap-8 mb-8">
                                    <div className="relative group shrink-0">
                                        <div className={cn(
                                            "absolute inset-0 blur-3xl opacity-0 group-hover:opacity-40 transition-opacity",
                                            "bg-violet-600/20"
                                        )} />
                                        <div className="w-40 h-40 rounded-2xl bg-background border border-border flex items-center justify-center relative z-10 shadow-sm">
                                            <Image
                                                src={getItemImageUrl(selectedItem.id, selectedItem.imgset?.[0]?.sd || selectedItem.img)}
                                                alt={selectedItem.name.fr}
                                                width={120}
                                                height={120}
                                                className="object-contain scale-110 group-hover:scale-125 transition-transform duration-300"
                                                unoptimized
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 pt-4">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className={cn(
                                                "px-4 py-1.5 rounded-full text-caption font-semibold border transition-colors",
                                                "bg-violet-500/10 text-violet-400 border-violet-500/20"
                                            )}>
                                                {selectedItem.type.name.fr}
                                            </span>
                                            <span className="px-4 py-1.5 rounded-full text-caption font-semibold bg-surface text-muted-foreground">
                                                Niveau {selectedItem.level}
                                            </span>
                                            <span className="ml-auto text-caption font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                <div className={cn("w-1.5 h-1.5 rounded-full", "bg-violet-500")} />
                                                DofusDB
                                            </span>
                                        </div>
                                        <h1 className="text-3xl font-black text-foreground tracking-tight mb-3">{selectedItem.name.fr}</h1>
                                        {selectedItem.description?.fr && (
                                            <p className="text-muted-foreground text-body-sm leading-relaxed italic border-l-2 border-border pl-4">{selectedItem.description.fr}</p>
                                        )}

                                        <div className="flex items-center gap-4 mt-8">
                                            <a
                                                href={`https://www.dofusdb.fr/fr/database/item/${selectedItem.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "px-6 py-3 rounded-2xl text-caption font-semibold flex items-center gap-2 transition-colors shadow-lg",
                                                    "bg-violet-600 hover:bg-violet-500 text-success-foreground"
                                                )}
                                            >
                                                Wiki Officiel <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto custom-scrollbar pr-4 pb-6">
                                    {/* Stats Card */}
                                    <div className="space-y-6">
                                        <div className="p-8 rounded-2xl bg-surface border border-border h-fit shadow-inner">
                                            <div className="flex items-center gap-3 mb-8">
                                                <Sword className={cn("h-5 w-5", "text-violet-400")} />
                                                <h4 className="text-caption font-semibold text-muted-foreground">Effets & Bonus</h4>
                                            </div>
                                            <div className="space-y-5">
                                                {(selectedItem.effects || selectedItem.possibleEffects || []).length > 0 ? (
                                                    (selectedItem.effects || selectedItem.possibleEffects || []).map((fx: any, i: number) => (
                                                        <div key={i} className="flex items-center justify-between group/fx">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border">
                                                                    <StatIcon characteristicId={fx.characteristic || fx.effectId} />
                                                                </div>
                                                                <span className="text-body-sm font-bold text-foreground group-hover/fx:text-foreground transition-colors">{getStatLabel(fx)}</span>
                                                            </div>
                                                            <span className={cn("text-body-sm font-black", "text-violet-400")}>
                                                                {fx.from === fx.to || fx.to === 0 ? fx.from : `${fx.from} à ${fx.to}`}
                                                            </span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-10 text-center opacity-20">
                                                        <Zap className="h-8 w-8 mx-auto mb-2" />
                                                        <p className="text-caption font-semibold">Aucun effet</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recipe Card */}
                                    <div className="space-y-6">
                                        <div className="p-8 rounded-2xl bg-surface border border-border shadow-inner">
                                            <div className="flex items-center justify-between gap-3 mb-8">
                                                <div className="flex items-center gap-3">
                                                    <Scroll className="h-5 w-5 text-muted-foreground" />
                                                    <h4 className="text-caption font-semibold text-muted-foreground">Fabrication</h4>
                                                </div>
                                            </div>

                                            {recipe ? (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {recipe.ingredients.map((ing, i) => (
                                                            <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-surface border border-border group/ing hover:border-border transition-colors">
                                                                <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center shrink-0">
                                                                    <Image src={getItemImageUrl(ing.id, ing.img)} alt="Ingredient" width={32} height={32} unoptimized />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-label font-bold text-foreground truncate group-hover/ing:text-foreground transition-colors">{ing.name.fr}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-20 border border-dashed border-border rounded-3xl flex flex-col items-center justify-center opacity-20 capitalize">
                                                    <PackageOpen className="h-10 w-10 mb-3" />
                                                    <p className="text-caption font-medium">Pas de recette disponible</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
