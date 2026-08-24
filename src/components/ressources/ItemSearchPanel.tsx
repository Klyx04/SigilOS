"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    Search, ExternalLink, Loader2, X, PackageOpen, BookMarked, Sword, Shield, Sparkles, Scroll, Coins,
    Zap, Heart, Brain, Droplet, Wind, Target, Eye, Footprints, Flame, Star, ShieldCheck, Plus,
    Crown, Circle, Layers, Award, Library, Copy, Check
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

const STAT_ICONS: Record<string | number, any> = {
    // Numbers for DofusDB
    11: { icon: Heart, color: "text-danger" },      // Vitalité
    125: { icon: Heart, color: "text-danger" },     // Vitalité (variant)
    12: { icon: Brain, color: "text-violet-400" },    // Sagesse
    13: { icon: Droplet, color: "text-info" },    // Chance
    14: { icon: Wind, color: "text-success" },   // Agilité
    15: { icon: Flame, color: "text-warning" },    // Intelligence
    16: { icon: Sword, color: "text-warning" },     // Force
    1: { icon: Zap, color: "text-warning" },        // PA
    23: { icon: Footprints, color: "text-success" }, // PM
    18: { icon: Target, color: "text-info" },     // Critique
    19: { icon: Eye, color: "text-info" },      // Portée
    25: { icon: Star, color: "text-fuchsia-400" },    // Puissance
    26: { icon: Plus, color: "text-success" },    // Soins
    28: { icon: Plus, color: "text-warning" },      // Invocations
    80: { icon: Shield, color: "text-muted-foreground" },     // Retrait PA
    83: { icon: Shield, color: "text-muted-foreground" },     // Retrait PM
    412: { icon: Shield, color: "text-muted-foreground" },    // Retrait PM
    87: { icon: ShieldCheck, color: "text-danger" }, // Résistance Critiques

    // Strings for Dofusbook (Strict mapping)
    "vi": { icon: Heart, color: "text-danger" },    // Vitalité
    "fo": { icon: Sword, color: "text-warning" },     // Force
    "sa": { icon: Brain, color: "text-violet-400" },    // Sagesse
    "ag": { icon: Wind, color: "text-success" },   // Agilité
    "in": { icon: Flame, color: "text-warning" },    // Intelligence
    "ch": { icon: Droplet, color: "text-info" },    // Chance
    "pu": { icon: Star, color: "text-fuchsia-400" },    // Puissance
    "cc": { icon: Target, color: "text-info" },     // Critique
    "dmg": { icon: Plus, color: "text-danger" },       // Dommages
    "ii": { icon: Zap, color: "text-warning" },      // Initiative
    "pi": { icon: Sparkles, color: "text-info" }, // Prospection (Solomonk case)
    "pp": { icon: Eye, color: "text-info" },        // Prospection
    "po": { icon: Eye, color: "text-info" },      // Portée
    "ic": { icon: Target, color: "text-success" },  // Invocations
    "pa": { icon: Zap, color: "text-warning" },
    "pm": { icon: Footprints, color: "text-success" },
    "ta": { icon: Plus, color: "text-green-500" },      // Tacle
    "fu": { icon: Star, color: "text-warning" },     // Fuite
    "so": { icon: Heart, color: "text-danger" },      // Soins

    // Dommages Elémentaires
    "dnf": { icon: Sword, color: "text-muted-foreground" },     // Dmg Neutre
    "dtf": { icon: Sword, color: "text-warning" },    // Dmg Terre
    "dff": { icon: Flame, color: "text-warning" },   // Dmg Feu
    "def": { icon: Droplet, color: "text-info" },   // Dmg Eau
    "daf": { icon: Wind, color: "text-success" },   // Dmg Air

    // Résistances %
    "rnp": { icon: Shield, color: "text-muted-foreground" },    // % Neutre
    "rtp": { icon: Shield, color: "text-warning" },   // % Terre
    "rfp": { icon: Shield, color: "text-warning" },  // % Feu
    "rep": { icon: Shield, color: "text-info" },    // % Eau
    "rap": { icon: Shield, color: "text-success" }, // % Air

    // Résistances Fixes
    "rn": { icon: ShieldCheck, color: "text-muted-foreground" },
    "rt": { icon: ShieldCheck, color: "text-warning" },
    "rf": { icon: ShieldCheck, color: "text-warning" },
    "re": { icon: ShieldCheck, color: "text-info" },
    "ra": { icon: ShieldCheck, color: "text-success" },

    // Annexes
    "rfc": { icon: Shield, color: "text-danger" },    // Rés. Crit
    "rp": { icon: Shield, color: "text-warning" },    // Rés. Poussée
    "pod": { icon: PackageOpen, color: "text-warning" }, // Pods
    "rpa": { icon: Shield, color: "text-muted-foreground" },    // Retrait PA
    "rpm": { icon: Shield, color: "text-muted-foreground" },    // Retrait PM
    "epa": { icon: ShieldCheck, color: "text-info" }, // Esquive PA
    "epm": { icon: ShieldCheck, color: "text-success" }, // Esquive PM
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
    // #178 — copier les ressources de craft (nom tel quel)
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [copiedRecipe, setCopiedRecipe] = useState(false);

    // Search DofusDB — via proxy serveur pour éviter CORS
    const searchDB = useCallback(async (q: string) => {
        if (!q.trim() || q.trim().length < 2) {
            setDbResults([]);
            return;
        }
        setDbLoading(true);
        try {
            const res = await fetch(`/api/dofusdb/search?q=${encodeURIComponent(q)}&limit=20`);
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
            // #189 — passer la catégorie à la route API (qui la transmet via &include= à Dofusbook)
            // + fallback client-side pour les champs category_id/category_name selon la réponse API
            const categoryParam = bookCategory ? `&category=${bookCategory}` : "";
            const res = await fetch(`/api/dofusbook/search?q=${encodeURIComponent(q)}${categoryParam}`);
            const data = await res.json();

            // Dofusbook returns either { results: [] }, { data: [] } or [] directly
            const results = Array.isArray(data) ? data : (data.data || data.results || []);
            if (data.error) throw new Error(data.error);

            // Fallback client-side filter au cas où le filtre serveur ne serait pas exhaustif
            let filtered = results;
            if (bookCategory) {
                const cat = DOFUSBOOK_CATEGORIES.find((c) => c.id === bookCategory);
                filtered = results.filter((item: any) => {
                    const rawCatId = item.category_id ?? item.categoryId;
                    if (typeof rawCatId === "number") return rawCatId === bookCategory;
                    if (typeof rawCatId === "string" && cat) return String(rawCatId) === String(cat.id);
                    const catName = String(item.category_name ?? item.categoryName ?? "").trim().toLowerCase();
                    return !!cat && catName === cat.name.toLowerCase();
                });
                // Si le filtre côté API a bien fonctionné, tous les items sont déjà filtrés
                // → fallback ne retire rien dans ce cas
                if (filtered.length === 0 && results.length > 0) {
                    // La réponse Dofusbook est déjà filtrée côté serveur → accepter tous les résultats
                    filtered = results;
                }
            }
            setBookResults(filtered);
        } catch {
            // Échec gracieux Dofusbook : pas de log console en prod.
            setBookResults([]);
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
            const res = await fetch(`/api/dofusdb/items/${item.id}`);
            if (res.ok) {
                const detailed = await res.json();
                if (!detailed.error) {
                    setSelectedItem(detailed);
                    if (detailed.hasRecipe) {
                        const recRes = await fetch(`/api/dofusdb/recipes/${item.id}`);
                        if (recRes.ok) {
                            const rec = await recRes.json();
                            if (!rec.error) setRecipe(rec);
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

    // #178 — copier les ressources de craft (nom tel quel, dofusbook + dofusdb)
    const handleCopyIngredient = (name: string, qty: number, idx: number) => {
        const text = `${name} x${qty}`;
        navigator.clipboard.writeText(text)
            .then(() => { setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); })
            .catch(() => {});
    };
    const handleCopyRecipe = () => {
        if (!recipe) return;
        const text = recipe.ingredients
            .map((ing, i) => `${ing.name.fr} x${recipe.quantities[i]}`)
            .join("\n");
        navigator.clipboard.writeText(text)
            .then(() => { setCopiedRecipe(true); setTimeout(() => setCopiedRecipe(false), 2000); })
            .catch(() => {});
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
                                        selectedItem?.id === item.id && source === "dofusdb"
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

                    {/* Dofusbook Block */}
                    <div className="rounded-2xl p-8 border border-success/20 shadow-sm bg-surface flex flex-col flex-1 transition-colors hover:border-success/30">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center border border-success/20 ">
                                    <BookMarked className="h-6 w-6 text-success" />
                                </div>
                                <div>
                                    <h2 className="text-label font-semibold text-success">Dofusbook</h2>
                                    <p className="text-caption text-muted-foreground font-medium mt-1">Expert Precision</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "p-2.5 rounded-xl border transition-colors flex items-center gap-2 text-caption font-semibold",
                                    showFilters ? "bg-success/20 border-success/40 text-success" : "bg-surface border-border text-muted-foreground hover:text-success-foreground"
                                )}
                            >
                                <Zap className="w-4 h-4" /> Filters
                            </button>
                        </div>

                        {showFilters && (
                            <div className="mb-8 p-6 rounded-xl bg-surface border border-success/20 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <p className="text-caption font-semibold text-success">Filtrer par type</p>
                                    <button
                                        onClick={() => setBookCategory(null)}
                                        className="text-caption font-bold text-muted-foreground hover:text-foreground transition-colors"
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
                                                    "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-colors group",
                                                    bookCategory === c.id
                                                        ? "bg-success/20 border-success/50 text-success  scale-105"
                                                        : "bg-surface border-border text-muted-foreground hover:bg-surface hover:border-success/20 hover:text-foreground"
                                                )}
                                            >
                                                <Icon className={cn(
                                                    "h-5 w-5 transition-transform group-",
                                                    bookCategory === c.id ? "text-success" : "text-muted-foreground group-hover:text-success/50"
                                                )} />
                                                <span className="text-caption font-semibold">{c.name}</span>
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
                                className="w-full bg-background/80 border border-success/20 rounded-2xl pl-12 pr-4 py-4 text-sm text-foreground outline-none focus:border-success/50 transition-colors placeholder:text-success/30 shadow-sm"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-success/40" />
                        </div>

                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {bookLoading && <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-success mx-auto" /></div>}
                            {!bookLoading && bookQuery.length >= 2 && bookResults.length === 0 && (
                                <div className="py-12 text-center">
                                    <PackageOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                                    <p className="text-caption font-semibold text-muted-foreground">Aucun résultat sur Dofusbook</p>
                                </div>
                            )}
                            {bookResults.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectBook(item)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-3 rounded-2xl border transition-colors group",
                                        selectedItem?.id === item.id && source === "dofusbook"
                                            ? "bg-success/10 border-success/40 "
                                            : "bg-surface border-border hover:bg-surface hover:border-border"
                                    )}
                                >
                                    <div className="w-11 h-11 rounded-xl bg-background flex items-center justify-center border border-border shrink-0 group- transition-transform">
                                        <Image src={getItemImageUrl(item.id, `https://www.dofusbook.net/static/dist/items/${item.picture || item.picture_id || item.id}-70.webp`)} alt={item.name} width={32} height={32} className="object-contain" unoptimized />
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <div className="text-body-sm font-bold text-foreground group-hover:text-foreground truncate">{item.name}</div>
                                        <div className="text-caption font-semibold text-success/60 uppercase tracking-tighter">Niv. {item.level}</div>
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
                        source === "dofusbook" ? "bg-success/10 border-success/20" : "bg-surface border-border"
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
                                            <h4 className="text-label font-semibold text-foreground">Multi-Sources</h4>
                                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-tight">DofusDB & Dofusbook</p>
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
                                            source === "dofusbook" ? "bg-success/20" : "bg-violet-600/20"
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
                                                source === "dofusbook"
                                                    ? "bg-success/10 text-success border-success/20"
                                                    : "bg-violet-500/10 text-violet-400 border-violet-500/20"
                                            )}>
                                                {selectedItem.type.name.fr}
                                            </span>
                                            <span className="px-4 py-1.5 rounded-full text-caption font-semibold bg-surface text-muted-foreground">
                                                Niveau {selectedItem.level}
                                            </span>
                                            <span className="ml-auto text-caption font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                <div className={cn("w-1.5 h-1.5 rounded-full", source === "dofusbook" ? "bg-success" : "bg-violet-500")} />
                                                Source: {source}
                                            </span>
                                        </div>
                                        <h1 className="text-3xl font-black text-foreground tracking-tight mb-3">{selectedItem.name.fr}</h1>
                                        {selectedItem.description?.fr && (
                                            <p className="text-muted-foreground text-body-sm leading-relaxed italic border-l-2 border-border pl-4">{selectedItem.description.fr}</p>
                                        )}

                                        <div className="flex items-center gap-4 mt-8">
                                            <a
                                                href={source === "dofusbook" ? `https://www.dofusbook.net/fr/encyclopedie/objet/${selectedItem.id}` : `https://www.dofusdb.fr/fr/database/item/${selectedItem.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "px-6 py-3 rounded-2xl text-caption font-semibold flex items-center gap-2 transition-colors shadow-lg",
                                                    source === "dofusbook" ? "bg-success hover:bg-success text-success-foreground" : "bg-violet-600 hover:bg-violet-500 text-success-foreground"
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
                                                <Sword className={cn("h-5 w-5", source === "dofusbook" ? "text-success" : "text-violet-400")} />
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
                                                            <span className={cn("text-body-sm font-black", source === "dofusbook" ? "text-success" : "text-violet-400")}>
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
                                                {/* #178 — copier toutes les ressources du craft (nom tel quel) */}
                                                {recipe && recipe.ingredients.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleCopyRecipe}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-caption font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                                                        title="Copier la liste des ressources"
                                                    >
                                                        {copiedRecipe ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                                        {copiedRecipe ? "Copié !" : "Copier la liste"}
                                                    </button>
                                                )}
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
                                                                    <div className="text-caption font-semibold text-success">x {recipe.quantities[i]}</div>
                                                                </div>
                                                                {/* #178 — copier le nom de la ressource tel quel */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopyIngredient(ing.name.fr, recipe.quantities[i], i)}
                                                                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0"
                                                                    title={`Copier « ${ing.name.fr} »`}
                                                                >
                                                                    {copiedIdx === i ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                                                                </button>
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
