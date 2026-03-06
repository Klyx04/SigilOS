"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, ExternalLink, Loader2, X, PackageOpen, BookMarked, Sword, Shield, Sparkles, Scroll, Coins, Zap, Heart, Brain, Droplet, Wind, Target, Eye, Footprints, Flame, Star, ShieldCheck, Plus } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

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

const CHAR_NAMES: Record<number, string> = {
    11: "Vitalité",
    12: "Sagesse",
    13: "Chance",
    14: "Agilité",
    15: "Intelligence",
    16: "Force",
    18: "Critique",
    19: "Portée",
    1: "PA",
    23: "PM",
    25: "Puissance",
    26: "Soins",
    27: "Dommages",
    28: "Invocations",
    48: "Résistance Feu (%)",
    49: "Résistance Eau (%)",
    50: "Résistance Air (%)",
    51: "Résistance Terre (%)",
    52: "Résistance Neutre (%)",
    89: "Dommages Feu",
    90: "Dommages Eau",
    91: "Dommages Air",
    92: "Dommages Terre",
    93: "Dommages Neutre",
    141: "Dommages Neutre",
    78: "Fuite",
    79: "Tacle",
    80: "Retrait PA",
    82: "Esquive PA",
    83: "Retrait PM",
    84: "Esquive PM",
    412: "Retrait PM",
    87: "Résistance Critiques",
    88: "Résistance Poussée",
    112: "Dommages Critiques",
    114: "Dommages Poussée",
    125: "Vitalité",
};

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

function getStatLabel(fx: DofusItemEffect): string {
    if (fx.int_name) return fx.int_name;
    const cid = fx.characteristic || fx.effectId || fx.int_id;
    return cid && CHAR_NAMES[cid] ? CHAR_NAMES[cid] : "Effet";
}

const STAT_ICONS: Record<number, any> = {
    11: { icon: Heart, color: "text-rose-500" },      // Vitalité
    125: { icon: Heart, color: "text-rose-500" },     // Vitalité (variant)
    12: { icon: Brain, color: "text-violet-400" },    // Sagesse
    13: { icon: Droplet, color: "text-blue-400" },    // Chance
    14: { icon: Wind, color: "text-emerald-400" },   // Agilité
    15: { icon: Flame, color: "text-orange-500" },    // Intelligence
    16: { icon: Sword, color: "text-amber-600" },     // Force
    1: { icon: Zap, color: "text-amber-400" },        // PA
    23: { icon: Footprints, color: "text-emerald-500" }, // PM
    18: { icon: Target, color: "text-blue-500" },     // Critique
    19: { icon: Eye, color: "text-indigo-400" },      // Portée
    25: { icon: Star, color: "text-fuchsia-400" },    // Puissance
    26: { icon: Plus, color: "text-emerald-400" },    // Soins
    28: { icon: Plus, color: "text-amber-500" },      // Invocations
    80: { icon: Shield, color: "text-zinc-400" },     // Retrait PA
    83: { icon: Shield, color: "text-zinc-400" },     // Retrait PM
    412: { icon: Shield, color: "text-zinc-400" },    // Retrait PM
    87: { icon: ShieldCheck, color: "text-rose-400" }, // Résistance Critiques
};

function StatIcon({ characteristicId }: { characteristicId?: number }) {
    if (!characteristicId || !STAT_ICONS[characteristicId]) {
        return <div className="w-1.5 h-1.5 rounded-full bg-violet-500/40" />;
    }
    const { icon: Icon, color } = STAT_ICONS[characteristicId];
    return <Icon className={cn("h-3.5 w-3.5", color)} />;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ItemSearchPanel() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<DofusItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [searched, setSearched] = useState(false);
    const [selectedItem, setSelectedItem] = useState<DofusItem | null>(null);
    const [recipe, setRecipe] = useState<DofusRecipe | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const search = useCallback(async (q: string) => {
        if (!q.trim() || q.trim().length < 2) {
            setResults([]);
            setSearched(false);
            return;
        }
        setLoading(true);
        setSearched(true);
        try {
            const url = `https://api.dofusdb.fr/items?slug.fr[$search]=${encodeURIComponent(q)}&$limit=8&$skip=0`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            const data = await res.json();
            setResults(data.data ?? []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim().length >= 2) search(query);
            else if (query.trim().length === 0) {
                setResults([]);
                setSearched(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [query, search]);

    const handleSelect = async (item: DofusItem) => {
        setLoadingDetail(true);
        setRecipe(null);
        try {
            const res = await fetch(`https://api.dofusdb.fr/items/${item.id}`, { headers: { Accept: "application/json" } });
            if (res.ok) {
                const detailed = await res.json();
                setSelectedItem(detailed);

                // Fetch recipe if item has one
                if (detailed.hasRecipe) {
                    const recRes = await fetch(`https://api.dofusdb.fr/recipes/${item.id}`);
                    if (recRes.ok) {
                        setRecipe(await recRes.json());
                    }
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
        <div className="w-full flex flex-col min-h-[500px] relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">

                {/* Sidebar Search */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="rounded-[2.5rem] p-6 border border-white/5 backdrop-blur-xl bg-black/40 h-full flex flex-col min-h-[400px]">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                <Search className="h-6 w-6 text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-widest text-white">Encyclopédie</h2>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">DofusDB Nexus</p>
                            </div>
                        </div>

                        <div className="relative mb-6">
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Rechercher un objet..."
                                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white outline-none focus:border-violet-500/50 transition-all"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600" />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {loading && <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" /></div>}
                            {results.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-2xl border transition-all ${selectedItem?.id === item.id ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.02] border-transparent hover:bg-white/5"}`}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center border border-white/5 shrink-0">
                                        <Image src={item.imgset?.[0]?.icon || item.img || ""} alt={item.name.fr} width={36} height={36} className="object-contain" unoptimized />
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <div className="text-[13px] font-bold text-white truncate">{item.name.fr}</div>
                                        <div className="text-[10px] font-black text-zinc-500 uppercase">Niveau {item.level}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Detail Panel */}
                <div className="lg:col-span-8">
                    <div className="h-full min-h-[400px] rounded-[2.5rem] border border-white/5 bg-black/40 backdrop-blur-xl p-6 flex flex-col relative overflow-hidden">
                        {!selectedItem ? (
                            <div className="text-center opacity-30">
                                <Sparkles className="h-20 w-20 mx-auto mb-6 text-violet-500" />
                                <h3 className="text-xl font-black uppercase tracking-widest text-white">Sélectionnez un item</h3>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
                                {loadingDetail && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-[2.5rem]">
                                        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row gap-6 mb-6">
                                    <div className="relative group shrink-0">
                                        <div className="absolute inset-0 bg-violet-600/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="w-32 h-32 rounded-[2.5rem] bg-black/40 border border-white/10 flex items-center justify-center relative z-10 shadow-2xl">
                                            <Image
                                                src={selectedItem.imgset?.[0]?.sd || selectedItem.img || ""}
                                                alt={selectedItem.name.fr}
                                                width={120}
                                                height={120}
                                                className="object-contain scale-110 group-hover:scale-125 transition-transform duration-500"
                                                unoptimized
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 pt-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                {selectedItem.type.name.fr}
                                            </span>
                                            <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-zinc-500">
                                                Niveau {selectedItem.level}
                                            </span>
                                        </div>
                                        <h1 className="text-2xl font-black text-white tracking-tight mb-2">{selectedItem.name.fr}</h1>
                                        {selectedItem.description?.fr && (
                                            <p className="text-zinc-400 text-sm leading-relaxed italic border-l-2 border-violet-500/30 pl-4">{selectedItem.description.fr}</p>
                                        )}

                                        <div className="flex items-center gap-4 mt-8">
                                            <a href={`https://www.dofusdb.fr/fr/database/item/${selectedItem.id}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all">
                                                Wiki Complet <ExternalLink className="h-3 w-3" />
                                            </a>
                                            {selectedItem.itemSet && (
                                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest">
                                                    <BookMarked className="h-3 w-3" /> {selectedItem.itemSet.name.fr}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto custom-scrollbar pr-4 pb-4">
                                    {/* Stats Card */}
                                    <div className="space-y-6">
                                        <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 h-fit">
                                            <div className="flex items-center gap-3 mb-6">
                                                <Sword className="h-5 w-5 text-violet-400" />
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Effets & Bonus</h4>
                                            </div>
                                            <div className="space-y-4">
                                                {(selectedItem.effects || selectedItem.possibleEffects || []).map((fx, i) => (
                                                    <div key={i} className="flex items-center justify-between group/fx py-0.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center shrink-0">
                                                                <StatIcon characteristicId={fx.characteristic || fx.effectId} />
                                                            </div>
                                                            <span className="text-xs font-bold text-white/80 group-hover/fx:text-white line-clamp-1">{getStatLabel(fx)}</span>
                                                        </div>
                                                        <span className="text-xs font-black text-violet-400 shrink-0">
                                                            {fx.from === fx.to || fx.to === 0 ? fx.from : `${fx.from} à ${fx.to}`}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recipe & Obtention Card */}
                                    <div className="space-y-6">
                                        <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5">
                                            <div className="flex items-center gap-3 mb-6">
                                                <Scroll className="h-5 w-5 text-emerald-400" />
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Obtention & Disponibilité</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                <div className={`p-4 rounded-2xl border ${selectedItem.isSaleable ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/5 text-zinc-600'}`}>
                                                    <div className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Hôtel de Vente</div>
                                                    <div className="text-xs font-black uppercase">{selectedItem.isSaleable ? 'Oui' : 'Non'}</div>
                                                </div>
                                                <div className={`p-4 rounded-2xl border ${selectedItem.hasRecipe ? 'bg-violet-500/5 border-violet-500/20 text-violet-400' : 'bg-white/5 border-white/5 text-zinc-600'}`}>
                                                    <div className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Fabrication</div>
                                                    <div className="text-xs font-black uppercase">{selectedItem.hasRecipe ? 'Recette' : 'Néant'}</div>
                                                </div>
                                            </div>

                                            {recipe ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between px-2 mb-2">
                                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Ingrédients Requis</span>
                                                        <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded-md">
                                                            {recipe.job?.name.fr} Niv. {recipe.resultLevel}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {recipe.ingredients.map((ing, i) => (
                                                            <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-black/40 border border-white/5 group/ing">
                                                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                                                    <Image src={ing.img || `https://api.dofusdb.fr/img/items/${ing.id}.png`} alt="Ingredient" width={28} height={28} unoptimized />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[11px] font-bold text-white/70 truncate group-hover/ing:text-white">{ing.name.fr}</div>
                                                                    <div className="text-[10px] font-black text-emerald-400/80">x {recipe.quantities[i]}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : selectedItem.hasRecipe ? (
                                                <div className="flex items-center justify-center py-10 opacity-30">
                                                    <Loader2 className="h-5 w-5 animate-spin mr-3" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Chargement recette...</span>
                                                </div>
                                            ) : (
                                                <div className="py-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center opacity-30">
                                                    <PackageOpen className="h-8 w-8 mb-2" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest">Pas de recette de craft</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pro-tip removed for space */}
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
