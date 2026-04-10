"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    Search, ExternalLink, Loader2, X, PackageOpen, BookMarked, Sword, Shield, Sparkles, Scroll, Coins,
    Zap, Heart, Brain, Droplet, Wind, Target, Eye, Footprints, Flame, Star, ShieldCheck, Plus,
    Crown, Circle, Layers, Award, Library
} from "lucide-react";
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

const DOFUSBOOK_CATEGORIES = [
    { id: 16, name: "Chapeau", icon: Crown },
    { id: 17, name: "Cape", icon: Wind },
    { id: 12, name: "Amulette", icon: Heart },
    { id: 13, name: "Anneau", icon: Circle },
    { id: 15, name: "Ceinture", icon: Layers },
    { id: 14, name: "Bottes", icon: Footprints },
    { id: 82, name: "Bouclier", icon: Shield },
    { id: 151, name: "Dofus", icon: Sparkles },
    { id: 152, name: "Trophée", icon: Award },
    { id: 18, name: "Arme", icon: Sword },
];

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

const STAT_ICONS: Record<string | number, any> = {
    // Numbers for DofusDB
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

    // Strings for Dofusbook (Strict mapping)
    "vi": { icon: Heart, color: "text-rose-500" },    // Vitalité
    "fo": { icon: Sword, color: "text-amber-600" },     // Force
    "sa": { icon: Brain, color: "text-violet-400" },    // Sagesse
    "ag": { icon: Wind, color: "text-emerald-400" },   // Agilité
    "in": { icon: Flame, color: "text-orange-500" },    // Intelligence
    "ch": { icon: Droplet, color: "text-blue-400" },    // Chance
    "pu": { icon: Star, color: "text-fuchsia-400" },    // Puissance
    "cc": { icon: Target, color: "text-blue-500" },     // Critique
    "dmg": { icon: Plus, color: "text-red-500" },       // Dommages
    "ii": { icon: Zap, color: "text-yellow-400" },      // Initiative
    "pi": { icon: Sparkles, color: "text-indigo-400" }, // Prospection (Solomonk case)
    "pp": { icon: Eye, color: "text-blue-400" },        // Prospection
    "po": { icon: Eye, color: "text-indigo-400" },      // Portée
    "ic": { icon: Target, color: "text-emerald-400" },  // Invocations
    "pa": { icon: Zap, color: "text-amber-400" },
    "pm": { icon: Footprints, color: "text-emerald-500" },
    "ta": { icon: Plus, color: "text-green-500" },      // Tacle
    "fu": { icon: Star, color: "text-orange-400" },     // Fuite
    "so": { icon: Heart, color: "text-rose-400" },      // Soins

    // Dommages Elémentaires
    "dnf": { icon: Sword, color: "text-zinc-400" },     // Dmg Neutre
    "dtf": { icon: Sword, color: "text-amber-700" },    // Dmg Terre
    "dff": { icon: Flame, color: "text-orange-600" },   // Dmg Feu
    "def": { icon: Droplet, color: "text-blue-600" },   // Dmg Eau
    "daf": { icon: Wind, color: "text-emerald-600" },   // Dmg Air

    // Résistances %
    "rnp": { icon: Shield, color: "text-zinc-400" },    // % Neutre
    "rtp": { icon: Shield, color: "text-amber-700" },   // % Terre
    "rfp": { icon: Shield, color: "text-orange-600" },  // % Feu
    "rep": { icon: Shield, color: "text-blue-600" },    // % Eau
    "rap": { icon: Shield, color: "text-emerald-600" }, // % Air

    // Résistances Fixes
    "rn": { icon: ShieldCheck, color: "text-zinc-500" },
    "rt": { icon: ShieldCheck, color: "text-amber-800" },
    "rf": { icon: ShieldCheck, color: "text-orange-700" },
    "re": { icon: ShieldCheck, color: "text-blue-700" },
    "ra": { icon: ShieldCheck, color: "text-emerald-700" },

    // Annexes
    "rfc": { icon: Shield, color: "text-rose-500" },    // Rés. Crit
    "rp": { icon: Shield, color: "text-amber-600" },    // Rés. Poussée
    "pod": { icon: PackageOpen, color: "text-amber-800" }, // Pods
    "rpa": { icon: Shield, color: "text-zinc-400" },    // Retrait PA
    "rpm": { icon: Shield, color: "text-zinc-400" },    // Retrait PM
    "epa": { icon: ShieldCheck, color: "text-blue-400" }, // Esquive PA
    "epm": { icon: ShieldCheck, color: "text-emerald-400" }, // Esquive PM
};

const BOOK_STAT_NAMES: Record<string, string> = {
    "vi": "Vitalité",
    "fo": "Force",
    "sa": "Sagesse",
    "ag": "Agilité",
    "in": "Intelligence",
    "ch": "Chance",
    "pu": "Puissance",
    "cc": "Coup Critique",
    "dmg": "Dommages",
    "ii": "Initiative",
    "pi": "Dommages Piège",
    "pp": "Prospection",
    "po": "Portée",
    "pod": "Pods",
    "ic": "Invocations",
    "pa": "PA",
    "pm": "PM",
    "ta": "Tacle",
    "fu": "Fuite",
    "so": "Soins",
    "rpa": "Retrait PA",
    "epa": "Esquive PA",
    "rpm": "Retrait PM",
    "epm": "Esquive PM",
    "dnf": "Dommages Neutre",
    "dtf": "Dommages Terre",
    "dff": "Dommages Feu",
    "def": "Dommages Eau",
    "daf": "Dommages Air",
    "rnp": "Résistance Neutre (%)",
    "rtp": "Résistance Terre (%)",
    "rfp": "Résistance Feu (%)",
    "rep": "Résistance Eau (%)",
    "rap": "Résistance Air (%)",
    "rn": "Résistance Neutre",
    "rt": "Résistance Terre",
    "rf": "Résistance Feu",
    "re": "Résistance Eau",
    "ra": "Résistance Air",
    "dc": "Dommages Critiques",
    "dp": "Résistance Poussée",
    "rfc": "Résistance Critiques",
    "rp": "Résistance Poussée",
};

function getStatLabel(fx: DofusItemEffect): string {
    if (fx.int_name && BOOK_STAT_NAMES[fx.int_name]) return BOOK_STAT_NAMES[fx.int_name];
    if (fx.int_name) return fx.int_name;
    const cid = fx.characteristic || fx.effectId || fx.int_id;
    return cid && CHAR_NAMES[cid] ? CHAR_NAMES[cid] : "Effet";
}

function StatIcon({ characteristicId, charCode }: { characteristicId?: number, charCode?: string }) {
    const key = charCode || characteristicId;
    if (!key || !STAT_ICONS[key]) {
        return <div className="w-1.5 h-1.5 rounded-full bg-violet-500/40" />;
    }
    const { icon: Icon, color } = STAT_ICONS[key];
    return <Icon className={cn("h-3.5 w-3.5", color)} />;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ItemSearchPanel() {
    // DofusDB States
    const [dbQuery, setDbQuery] = useState("");
    const [dbResults, setDbResults] = useState<DofusItem[]>([]);
    const [dbLoading, setDbLoading] = useState(false);

    // Dofusbook States
    const [bookQuery, setBookQuery] = useState("");
    const [bookResults, setBookResults] = useState<any[]>([]);
    const [bookLoading, setBookLoading] = useState(false);
    const [bookCategory, setBookCategory] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Common States
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [recipe, setRecipe] = useState<DofusRecipe | null>(null);
    const [source, setSource] = useState<"dofusdb" | "dofusbook">("dofusdb");

    // Search DofusDB
    const searchDB = useCallback(async (q: string) => {
        if (!q.trim() || q.trim().length < 2) {
            setDbResults([]);
            return;
        }
        setDbLoading(true);
        try {
            const url = `https://api.dofusdb.fr/items?slug.fr[$search]=${encodeURIComponent(q)}&$limit=8&$skip=0`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            const data = await res.json();
            setDbResults(data.data ?? []);
        } catch {
            setDbResults([]);
        } finally {
            setDbLoading(false);
        }
    }, []);

    // Search Dofusbook
    const searchBook = useCallback(async (q: string) => {
        if (!q.trim() || q.trim().length < 2) {
            setBookResults([]);
            return;
        }
        setBookLoading(true);
        try {
            const catParam = bookCategory ? `&category=${bookCategory}` : "";
            const res = await fetch(`/api/dofusbook/search?q=${encodeURIComponent(q)}${catParam}`);
            const data = await res.json();

            // Dofusbook returns either { results: [] }, { data: [] } or [] directly
            const results = Array.isArray(data) ? data : (data.data || data.results || []);
            if (data.error) throw new Error(data.error);
            setBookResults(results);
        } catch (err: any) {
            console.error("[Dofusbook Search] Error:", err);
            setBookResults([]);
            // Optional: You could show a specialized error toast or inline message here
        } finally {
            setBookLoading(false);
        }
    }, [bookCategory]);

    // Timers
    useEffect(() => {
        const timer = setTimeout(() => {
            if (dbQuery.trim().length >= 2) searchDB(dbQuery);
            else if (dbQuery.trim().length === 0) setDbResults([]);
        }, 350);
        return () => clearTimeout(timer);
    }, [dbQuery, searchDB]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (bookQuery.trim().length >= 2) searchBook(bookQuery);
            else if (bookQuery.trim().length === 0) setBookResults([]);
        }, 350);
        return () => clearTimeout(timer);
    }, [bookQuery, searchBook]);

    const handleSelectDB = async (item: DofusItem) => {
        setSource("dofusdb");
        setLoadingDetail(true);
        setRecipe(null);
        try {
            const res = await fetch(`https://api.dofusdb.fr/items/${item.id}`, { headers: { Accept: "application/json" } });
            if (res.ok) {
                const detailed = await res.json();
                setSelectedItem(detailed);
                if (detailed.hasRecipe) {
                    const recRes = await fetch(`https://api.dofusdb.fr/recipes/${item.id}`);
                    if (recRes.ok) setRecipe(await recRes.json());
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

    const handleSelectBook = (item: any) => {
        setSource("dofusbook");
        // Normalize Dofusbook data to match our UI expected format
        const pic = item.picture || item.picture_id || item.id;
        const normalized: DofusItem = {
            id: item.id,
            name: { fr: item.name },
            level: item.level,
            type: { name: { fr: item.category_name || "Équipement" } },
            img: `https://www.dofusbook.net/static/dist/items/${pic}-200.webp`,
            effects: (item.effects || []).map((e: any) => ({
                characteristic: undefined,
                from: e.min,
                to: e.max,
                int_name: e.name
            })),
            description: { fr: item.description || "" },
            hasRecipe: !!(item.ingredients && item.ingredients.length > 0)
        };

        setSelectedItem(normalized);
        if (normalized.hasRecipe) {
            setRecipe({
                ingredients: item.ingredients.map((ing: any) => {
                    const ingPic = ing.picture || ing.picture_id || ing.item_id || ing.id;
                    return {
                        id: ing.id || ing.item_id,
                        name: { fr: ing.name || ing.item_name },
                        img: `https://www.dofusbook.net/static/dist/items/${ingPic}-70.webp`
                    };
                }),
                quantities: item.ingredients.map((ing: any) => ing.count || ing.quantity)
            });
        } else {
            setRecipe(null);
        }
    };

    return (
        <div className="w-full flex flex-col min-h-[600px] relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">

                {/* Sidebar Search */}
                <div className="lg:col-span-4 flex flex-col gap-8">

                    {/* DofusDB Block */}
                    <div className="rounded-[2.5rem] p-8 border border-white/10 shadow-2xl bg-zinc-900/40 backdrop-blur-2xl flex flex-col transition-all hover:border-violet-500/20">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                                <Search className="h-6 w-6 text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-white">DofusDB Nexus</h2>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Global Quick Search</p>
                            </div>
                        </div>

                        <div className="relative mb-6">
                            <input
                                type="text"
                                value={dbQuery}
                                onChange={(e) => setDbQuery(e.target.value)}
                                placeholder="Rechercher un objet..."
                                className="w-full bg-zinc-950/60 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white outline-none focus:border-violet-500/50 focus:bg-zinc-950/80 transition-all placeholder:text-zinc-600 shadow-inner"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        </div>

                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {dbLoading && <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" /></div>}
                            {dbResults.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectDB(item)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-3 rounded-2xl border transition-all group",
                                        selectedItem?.id === item.id && source === "dofusdb"
                                            ? "bg-violet-500/10 border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                                            : "bg-white/[0.03] border-white/5 hover:bg-white/5 hover:border-white/10"
                                    )}
                                >
                                    <div className="w-11 h-11 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shrink-0 group-hover:scale-105 transition-transform">
                                        <Image src={item.imgset?.[0]?.icon || item.img || ""} alt={item.name.fr} width={32} height={32} className="object-contain" unoptimized />
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <div className="text-[13px] font-bold text-zinc-100 group-hover:text-white truncate">{item.name.fr}</div>
                                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">Niv. {item.level}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dofusbook Block */}
                    <div className="rounded-[2.5rem] p-8 border border-emerald-500/20 shadow-2xl bg-zinc-900/40 backdrop-blur-2xl flex flex-col flex-1 transition-all hover:border-emerald-500/30">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                    <BookMarked className="h-6 w-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-emerald-400">Dofusbook</h2>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Expert Precision</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "p-2.5 rounded-xl border transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",
                                    showFilters ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-zinc-500 hover:text-white"
                                )}
                            >
                                <Zap className="w-4 h-4" /> Filters
                            </button>
                        </div>

                        {showFilters && (
                            <div className="mb-8 p-6 rounded-[2rem] bg-black/60 border border-emerald-500/20 shadow-xl animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Filtrer par type</p>
                                    <button
                                        onClick={() => setBookCategory(null)}
                                        className="text-[9px] font-bold text-zinc-500 hover:text-white transition-colors"
                                    >
                                        Réinitialiser
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {DOFUSBOOK_CATEGORIES.map((c) => {
                                        const Icon = c.icon;
                                        return (
                                            <button
                                                key={c.id}
                                                onClick={() => setBookCategory(bookCategory === c.id ? null : c.id)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all group",
                                                    bookCategory === c.id
                                                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] scale-105"
                                                        : "bg-white/[0.03] border-white/5 text-zinc-500 hover:bg-white/5 hover:border-emerald-500/20 hover:text-zinc-300"
                                                )}
                                            >
                                                <Icon className={cn(
                                                    "h-5 w-5 transition-transform group-hover:scale-110",
                                                    bookCategory === c.id ? "text-emerald-400" : "text-zinc-600 group-hover:text-emerald-500/50"
                                                )} />
                                                <span className="text-[8px] font-black uppercase tracking-widest">{c.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="relative mb-6">
                            <input
                                type="text"
                                value={bookQuery}
                                onChange={(e) => setBookQuery(e.target.value)}
                                placeholder="Chercher sur Dofusbook..."
                                className="w-full bg-zinc-950/80 border border-emerald-500/20 rounded-2xl pl-12 pr-4 py-4 text-sm text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-emerald-500/30 shadow-2xl"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500/40" />
                        </div>

                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {bookLoading && <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto" /></div>}
                            {!bookLoading && bookQuery.length >= 2 && bookResults.length === 0 && (
                                <div className="py-12 text-center">
                                    <PackageOpen className="h-10 w-10 text-zinc-700 mx-auto mb-3 opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Aucun résultat sur Dofusbook</p>
                                </div>
                            )}
                            {bookResults.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectBook(item)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-3 rounded-2xl border transition-all group",
                                        selectedItem?.id === item.id && source === "dofusbook"
                                            ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                            : "bg-white/[0.03] border-white/5 hover:bg-white/5 hover:border-white/10"
                                    )}
                                >
                                    <div className="w-11 h-11 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shrink-0 group-hover:scale-105 transition-transform">
                                        <Image src={`https://www.dofusbook.net/static/dist/items/${item.picture || item.picture_id || item.id}-70.webp`} alt={item.name} width={32} height={32} className="object-contain" unoptimized />
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <div className="text-[13px] font-bold text-zinc-100 group-hover:text-white truncate">{item.name}</div>
                                        <div className="text-[10px] font-black text-emerald-500/60 uppercase tracking-tighter">Niv. {item.level}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Detail Panel */}
                <div className="lg:col-span-8">
                    <div className={cn(
                        "h-full min-h-[600px] rounded-[3rem] border backdrop-blur-3xl p-10 flex flex-col relative overflow-hidden transition-all duration-700 shadow-2xl",
                        source === "dofusbook" ? "bg-emerald-950/10 border-emerald-500/20" : "bg-zinc-900/40 border-white/10"
                    )}>
                        {!selectedItem ? (
                            <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-1000">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-violet-500/20 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-colors duration-1000" />
                                    <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-violet-500/10 to-emerald-500/10 border border-white/10 flex items-center justify-center relative z-10 shadow-2xl group-hover:scale-110 transition-transform duration-500 backdrop-blur-xl">
                                        <Library className="h-10 w-10 text-white animate-pulse" />
                                    </div>
                                </div>

                                <div className="space-y-4 max-w-lg relative z-10">
                                    <h3 className="text-4xl font-black uppercase tracking-tighter text-white leading-none">
                                        Nexus <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-white to-emerald-400">Encyclopédique</span>
                                    </h3>
                                    <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                                        Votre archive centrale synchronisée. Recherchez n&apos;importe quel équipement, ressource ou dofus pour consulter ses statistiques et sa recette de craft en temps réel.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-8 relative z-10">
                                    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-3 hover:border-violet-500/30 hover:bg-white/[0.04] transition-all group/card">
                                        <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-2 border border-violet-500/20 group-hover/card:scale-110 transition-transform">
                                            <Zap className="h-5 w-5 text-violet-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-[12px] font-black uppercase tracking-widest text-zinc-100">Effets Directs</h4>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Jets min/max & bonus</p>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-3 hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all group/card">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-2 border border-emerald-500/20 group-hover/card:scale-110 transition-transform">
                                            <Scroll className="h-5 w-5 text-emerald-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-[12px] font-black uppercase tracking-widest text-zinc-100">Fabrication</h4>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Recettes & quantités</p>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-3 hover:border-amber-500/30 hover:bg-white/[0.04] transition-all group/card">
                                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-2 border border-amber-500/20 group-hover/card:scale-110 transition-transform">
                                            <ExternalLink className="h-5 w-5 text-amber-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-[12px] font-black uppercase tracking-widest text-zinc-100">Multi-Sources</h4>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">DofusDB & Dofusbook</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-12 text-zinc-700">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4 justify-center">
                                        <div className="w-12 h-px bg-current opacity-20" />
                                        Recherchez pour commencer
                                        <div className="w-12 h-px bg-current opacity-20" />
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
                                {loadingDetail && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-[2.5rem]">
                                        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row gap-8 mb-8">
                                    <div className="relative group shrink-0">
                                        <div className={cn(
                                            "absolute inset-0 blur-3xl opacity-0 group-hover:opacity-40 transition-opacity",
                                            source === "dofusbook" ? "bg-emerald-500/20" : "bg-violet-600/20"
                                        )} />
                                        <div className="w-40 h-40 rounded-[2.5rem] bg-black/40 border border-white/10 flex items-center justify-center relative z-10 shadow-2xl">
                                            <Image
                                                src={selectedItem.imgset?.[0]?.sd || selectedItem.img || ""}
                                                alt={selectedItem.name.fr}
                                                width={120}
                                                height={120}
                                                className="object-contain scale-110 group-hover:scale-125 transition-transform duration-700"
                                                unoptimized
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 pt-4">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className={cn(
                                                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors",
                                                source === "dofusbook"
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                    : "bg-violet-500/10 text-violet-400 border-violet-500/20"
                                            )}>
                                                {selectedItem.type.name.fr}
                                            </span>
                                            <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-zinc-500">
                                                Niveau {selectedItem.level}
                                            </span>
                                            <span className="ml-auto text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                <div className={cn("w-1.5 h-1.5 rounded-full", source === "dofusbook" ? "bg-emerald-500" : "bg-violet-500")} />
                                                Source: {source}
                                            </span>
                                        </div>
                                        <h1 className="text-3xl font-black text-white tracking-tight mb-3">{selectedItem.name.fr}</h1>
                                        {selectedItem.description?.fr && (
                                            <p className="text-zinc-400 text-[13px] leading-relaxed italic border-l-2 border-zinc-700 pl-4">{selectedItem.description.fr}</p>
                                        )}

                                        <div className="flex items-center gap-4 mt-8">
                                            <a
                                                href={source === "dofusbook" ? `https://www.dofusbook.net/fr/encyclopedie/objet/${selectedItem.id}` : `https://www.dofusdb.fr/fr/database/item/${selectedItem.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg",
                                                    source === "dofusbook" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-violet-600 hover:bg-violet-500 text-white"
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
                                        <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 h-fit shadow-inner">
                                            <div className="flex items-center gap-3 mb-8">
                                                <Sword className={cn("h-5 w-5", source === "dofusbook" ? "text-emerald-400" : "text-violet-400")} />
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Effets & Bonus</h4>
                                            </div>
                                            <div className="space-y-5">
                                                {(selectedItem.effects || selectedItem.possibleEffects || []).length > 0 ? (
                                                    (selectedItem.effects || selectedItem.possibleEffects || []).map((fx: any, i: number) => (
                                                        <div key={i} className="flex items-center justify-between group/fx">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center shrink-0 border border-white/5">
                                                                    <StatIcon characteristicId={fx.characteristic || fx.effectId} />
                                                                </div>
                                                                <span className="text-[13px] font-bold text-zinc-300 group-hover/fx:text-white transition-colors">{getStatLabel(fx)}</span>
                                                            </div>
                                                            <span className={cn("text-[13px] font-black", source === "dofusbook" ? "text-emerald-400" : "text-violet-400")}>
                                                                {fx.from === fx.to || fx.to === 0 ? fx.from : `${fx.from} à ${fx.to}`}
                                                            </span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-10 text-center opacity-20">
                                                        <Zap className="h-8 w-8 mx-auto mb-2" />
                                                        <p className="text-[10px] font-black uppercase">Aucun effet</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recipe Card */}
                                    <div className="space-y-6">
                                        <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 shadow-inner">
                                            <div className="flex items-center gap-3 mb-8">
                                                <Scroll className="h-5 w-5 text-zinc-500" />
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Fabrication</h4>
                                            </div>

                                            {recipe ? (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {recipe.ingredients.map((ing, i) => (
                                                            <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-black/50 border border-white/5 group/ing hover:border-white/10 transition-all">
                                                                <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center shrink-0">
                                                                    <Image src={ing.img || `https://static.dofusdb.fr/items/${ing.id}.png`} alt="Ingredient" width={32} height={32} unoptimized />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[12px] font-bold text-zinc-200 truncate group-hover/ing:text-white transition-colors">{ing.name.fr}</div>
                                                                    <div className="text-[11px] font-black text-emerald-400">x {recipe.quantities[i]}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-20 border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center opacity-20 capitalize">
                                                    <PackageOpen className="h-10 w-10 mb-3" />
                                                    <p className="text-[11px] font-black tracking-widest">Pas de recette disponible</p>
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
