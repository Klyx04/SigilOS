"use client";

import { useState, useCallback, useEffect } from "react";
import {
    Search, ExternalLink, Loader2, PackageOpen, Copy, Check,
    Zap, Heart, Brain, Droplet, Wind, Target, Eye, Footprints, Flame, Star, Shield, ShieldCheck, Sparkles, Plus
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
    getStatLabel as sharedGetStatLabel,
    resolveStatIconSpec,
    type StatIconName,
} from "@/lib/market/effects";
import { resolveDofusStatTheme, getDofusStatNumberColor } from "@/lib/dofus-stats-theme";
import { iconVersionOf } from "@/lib/market/item-image";
import {
    ENCYCLOPEDIA_CATEGORIES,
    ENCYCLOPEDIA_CATEGORY_LABELS,
    resolveEncyclopediaBlocks,
    resolveEncyclopediaMetaChips,
    type EncyclopediaCategory,
} from "@/lib/ressources/encyclopedia-display";

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

/** Icône neutre quand le proxy ne résout rien (jamais de case verte vide). */
const ITEM_ICON_FALLBACK = "/assets/dofus/game-icons/dofus.png";

function handleItemImageError(e: React.SyntheticEvent<HTMLImageElement>) {
    const target = e.currentTarget;
    if (!target.dataset.fbk) {
        target.dataset.fbk = "1";
        target.src = ITEM_ICON_FALLBACK;
    }
}

interface DofusItem {
    id: number;
    name: { fr: string };
    level: number;
    type: { name: { fr: string } };
    description?: { fr: string };
    /** Métas siphonnées (poids, panoplie). */
    realWeight?: number | null;
    itemSetName?: string | null;
    imgset?: { sd?: string; icon?: string }[];
    img?: string;
    /** 10/10/2026 — resiphon : `?v=` d'invalidation d'icône (DofusDB `updatedAt` ou local). */
    updatedAt?: string | null;
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
 * 10/10/2026 — `version` (`?v=updatedAt`) : chaque resiphon change l'URL, fini le cache
 * périmé (navigateurs + Discord) pour toutes les guildes.
 */
function getItemImageUrl(id?: number | string | null, fallbackUrl?: string | null, version?: number | string | null): string {
    if (id) {
        const params = new URLSearchParams();
        if (fallbackUrl) params.set("url", fallbackUrl);
        if (version !== undefined && version !== null && String(version).trim() !== "") params.set("v", String(version));
        const query = params.toString();
        return `/api/assets-dofus/items/${id}${query ? `?${query}` : ""}`;
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

function getJobIcon(jobName?: string): string | null {
    if (!jobName) return null;
    const clean = jobName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (clean.includes("bijoutier")) return "/assets/dofus/jobs/bijoutier.png";
    if (clean.includes("forgeron")) return "/assets/dofus/jobs/forgeron.png";
    if (clean.includes("tailleur")) return "/assets/dofus/jobs/tailleur.png";
    if (clean.includes("cordonnier")) return "/assets/dofus/jobs/cordonnier.png";
    if (clean.includes("faconneur")) return "/assets/dofus/jobs/faconneur.png";
    if (clean.includes("bricoleur")) return "/assets/dofus/jobs/bricoleur.png";
    if (clean.includes("alchimiste")) return "/assets/dofus/jobs/alchimiste.png";
    if (clean.includes("sculpteur")) return "/assets/dofus/jobs/sculpteur.png";
    if (clean.includes("chasseur")) return "/assets/dofus/jobs/chasseur.png";
    if (clean.includes("pecheur")) return "/assets/dofus/jobs/pecheur.png";
    if (clean.includes("paysan")) return "/assets/dofus/jobs/paysan.png";
    if (clean.includes("mineur")) return "/assets/dofus/jobs/mineur.png";
    if (clean.includes("bucheron")) return "/assets/dofus/jobs/bucheron.png";
    return null;
}

/**
 * Mapping slug d'icône partagé → composant lucide (fallback de sécurité pour les stats non thémées).
 */
const ICON_COMPONENTS: Record<StatIconName, any> = {
    heart: Heart,
    brain: Brain,
    droplet: Droplet,
    wind: Wind,
    flame: Flame,
    sword: Zap,
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
 * Libellé FR d'un effet
 */
function getStatLabel(fx: DofusItemEffect): string {
    return sharedGetStatLabel(fx);
}

function parseEffectRange(fx: any): { from: number; to: number } {
    const rawFrom = fx.from ?? fx.diceNum ?? fx.min ?? fx.value;
    const rawTo = fx.to ?? (fx.diceSide !== undefined && fx.diceSide !== 0 ? fx.diceSide : rawFrom) ?? fx.max ?? rawFrom;
    const from = Number(rawFrom ?? 0);
    const to = Number(rawTo ?? from);
    return { from, to };
}

function formatEffectDisplay(fx: any): string {
    const { from, to } = parseEffectRange(fx);
    if (from === to || to === 0 || !to) {
        return from > 0 ? `+${from}` : `${from}`;
    }
    const signFrom = from > 0 ? `+${from}` : `${from}`;
    return `${signFrom} à ${to}`;
}

function StatIcon({ characteristicId, effectId, charCode }: { characteristicId?: number, effectId?: number, charCode?: string }) {
    const dofusTheme = resolveDofusStatTheme(characteristicId, effectId, charCode);
    if (dofusTheme?.asset) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={`/assets/dofus/stats/${dofusTheme.asset}`}
                alt={dofusTheme.label || "Stat"}
                className="h-4 w-4 object-contain shrink-0"
            />
        );
    }
    const spec = resolveStatIconSpec(characteristicId, charCode);
    if (!spec) {
        return <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />;
    }
    const Icon = ICON_COMPONENTS[spec.icon];
    return <Icon className={cn("h-3.5 w-3.5", spec.color)} />;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ItemSearchPanel() {
    // States
    const [searchQuery, setSearchQuery] = useState("");
    // Filtre souverain par type (catégorie locale `GameItem.category`).
    const [typeFilter, setTypeFilter] = useState<EncyclopediaCategory>("all");
    const [searchResults, setSearchResults] = useState<DofusItem[]>([]);
    const [searching, setSearching] = useState(false);

    // Detail States
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [recipe, setRecipe] = useState<DofusRecipe | null>(null);
    const [loadingRecipe, setLoadingRecipe] = useState(false);
    const [copiedIngredient, setCopiedIngredient] = useState<string | null>(null);

    const performSearch = useCallback(async (q: string, cat: EncyclopediaCategory) => {
        if (!q.trim() || q.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const catParam = cat !== "all" ? `&category=${encodeURIComponent(cat)}` : "";
            const res = await fetch(`/api/dofusdb/search?q=${encodeURIComponent(q.trim())}&limit=20${catParam}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(Array.isArray(data.data) ? data.data : []);
            } else {
                setSearchResults([]);
            }
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length >= 2) performSearch(searchQuery, typeFilter);
            else if (searchQuery.trim().length === 0) setSearchResults([]);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery, typeFilter, performSearch]);

    const handleSelectItem = async (item: DofusItem) => {
        // 1. Affichage immédiat (0ms) — l'item et ses statistiques s'affichent sans aucun délai
        setSelectedItem(item);

        // Si la recette est déjà en cache
        if ((item as any).recipe) {
            setRecipe((item as any).recipe);
            return;
        }

        setRecipe(null);

        // Si l'item n'a pas de recette connue
        if (item.hasRecipe === false) {
            return;
        }

        // 2. Chargement non bloquant de la recette en arrière-plan
        setLoadingRecipe(true);
        try {
            const recRes = await fetch(`/api/dofusdb/recipes/${item.id}`);
            if (recRes.ok) {
                const rec = await recRes.json();
                if (rec && !rec.error) {
                    setRecipe(rec);
                    (item as any).recipe = rec;
                }
            }
        } catch {
            // Silencieux
        } finally {
            setLoadingRecipe(false);
        }
    };

    const handleCopyIngredient = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(name);
        setCopiedIngredient(name);
        toast.success(`"${name}" copié !`, {
            description: "Nom de ressource prêt à coller dans le jeu.",
            duration: 2000,
        });
        setTimeout(() => {
            setCopiedIngredient((curr) => (curr === name ? null : curr));
        }, 2000);
    };

    const currentJobIcon = recipe?.job?.name?.fr ? getJobIcon(recipe.job.name.fr) : null;

    // Blocs vides masqués : un objet sans effet ni recette n'affiche que son
    // en-tête (nom, niveau, description + lien DofusDB), jamais deux cartes vides.
    const detailEffectsList = selectedItem
        ? (selectedItem.effects || selectedItem.possibleEffects || [])
        : [];
    const detailBlocks = resolveEncyclopediaBlocks({
        effectsCount: detailEffectsList.length,
        hasRecipeFlag: (selectedItem?.hasRecipe as boolean | null | undefined) ?? null,
        hasRecipeData: recipe != null,
        loadingRecipe,
    });
    // Métas siphonnées (poids, panoplie) — jamais de prix : « PNJ : 1 kamas »
    // est du bruit, pas de l'info.
    const detailMetaChips = selectedItem
        ? resolveEncyclopediaMetaChips({
              realWeight: selectedItem.realWeight,
              itemSetName: selectedItem.itemSetName,
          })
        : [];

    return (
        <div className="w-full flex flex-col min-h-[600px] relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">

                {/* Sidebar Search */}
                <div className="lg:col-span-4 flex flex-col gap-8">

                    {/* Search Block */}
                    <div className="rounded-2xl p-8 border border-border shadow-sm bg-surface flex flex-col">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center border border-border shrink-0">
                                {/* Asset officiel Dofus parchemin / encyclopédie */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/assets/dofus/game-icons/recipe.png"
                                    alt="Encyclopédie"
                                    className="w-6 h-6 object-contain"
                                />
                            </div>
                            <div>
                                <h2 className="text-label font-semibold text-foreground">Encyclopédie</h2>
                                <p className="text-caption text-muted-foreground font-medium mt-1">Équipements & ressources</p>
                            </div>
                        </div>

                        <div className="relative mb-4">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Rechercher un objet..."
                                className="w-full bg-background/60 border border-border rounded-2xl pl-12 pr-4 py-4 text-sm text-foreground outline-none focus:border-border-strong focus:bg-background/80 transition-colors placeholder:text-muted-foreground"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filtrer par type">
                            {ENCYCLOPEDIA_CATEGORIES.map((cat) => {
                                const active = typeFilter === cat;
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setTypeFilter(cat)}
                                        aria-pressed={active}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                                            active
                                                ? "bg-elevated text-foreground border-border-strong"
                                                : "bg-background/60 text-muted-foreground border-border hover:text-foreground hover:border-border-strong"
                                        )}
                                    >
                                        {ENCYCLOPEDIA_CATEGORY_LABELS[cat]}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {searching && <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" /></div>}
                            {searchResults.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectItem(item)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-3 rounded-2xl border transition-colors group text-left",
                                        selectedItem?.id === item.id
                                            ? "bg-gold/10 border-gold/40"
                                            : "bg-surface/60 border-border hover:bg-elevated hover:border-border-strong"
                                    )}
                                >
                                    <div className="w-11 h-11 rounded-xl bg-background flex items-center justify-center border border-border shrink-0">
                                        <Image src={getItemImageUrl(item.id, item.imgset?.[0]?.icon || item.img, iconVersionOf(item.updatedAt))} alt={item.name.fr} width={32} height={32} className="object-contain" unoptimized onError={handleItemImageError} />
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <div className="text-body-sm font-bold text-foreground truncate">{item.name.fr}</div>
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
                        "h-full min-h-[600px] rounded-2xl border p-6 md:p-8 flex flex-col relative overflow-hidden",
                        "bg-surface/60 border-border"
                    )}>
                        {!selectedItem ? (
                            <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center space-y-8">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-2xl bg-elevated border border-border flex items-center justify-center relative z-10">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src="/assets/dofus/game-icons/dofus.png"
                                            alt="SigilOS"
                                            className="h-14 w-14 object-contain"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 max-w-lg relative z-10">
                                    <h3 className="text-3xl font-bold tracking-tight text-foreground leading-none">
                                        Nexus Encyclopédique
                                    </h3>
                                    <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                                        Votre archive centrale synchronisée. Recherchez n&apos;importe quel équipement, ressource ou dofus pour consulter ses statistiques et sa recette de craft en temps réel.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-8 relative z-10">
                                    <div className="p-6 rounded-xl bg-surface border border-border space-y-3">
                                        <div className="w-10 h-10 rounded-2xl bg-elevated flex items-center justify-center mx-auto mb-2 border border-border">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src="/assets/dofus/game-icons/crossed-swords.png"
                                                alt="Effets Directs"
                                                className="h-5 w-5 object-contain"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-label font-semibold text-foreground">Effets Directs</h4>
                                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-tight">Jets min/max & bonus</p>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-xl bg-surface border border-border space-y-3">
                                        <div className="w-10 h-10 rounded-2xl bg-elevated flex items-center justify-center mx-auto mb-2 border border-border">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src="/assets/dofus/game-icons/hammer.png"
                                                alt="Fabrication"
                                                className="h-5 w-5 object-contain"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-label font-semibold text-foreground">Fabrication</h4>
                                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-tight">Recettes & quantités</p>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-xl bg-surface border border-border space-y-3">
                                        <div className="w-10 h-10 rounded-2xl bg-elevated flex items-center justify-center mx-auto mb-2 border border-border">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src="/assets/dofus/game-icons/recipe.png"
                                                alt="Catalogue"
                                                className="h-5 w-5 object-contain"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-label font-semibold text-foreground">Catalogue d&apos;Objets</h4>
                                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-tight">Dofus synchronisé</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-12 text-muted-foreground">
                                    <div className="text-caption font-semibold flex items-center gap-4 justify-center">
                                        <div className="w-12 h-px bg-current opacity-20" />
                                        Recherchez pour commencer
                                        <div className="w-12 h-px bg-current opacity-20" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col">
                                <div className="flex flex-col md:flex-row gap-8 mb-8">
                                    <div className="shrink-0">
                                        <div className="w-40 h-40 rounded-2xl bg-background border border-border flex items-center justify-center relative z-10">
                                            <Image
                                                src={getItemImageUrl(selectedItem.id, selectedItem.imgset?.[0]?.sd || selectedItem.img, iconVersionOf(selectedItem.updatedAt))}
                                                alt={selectedItem.name.fr}
                                                width={120}
                                                height={120}
                                                className="object-contain"
                                                unoptimized
                                                onError={handleItemImageError}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 pt-4">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className={cn(
                                                "px-4 py-1.5 rounded-full text-caption font-semibold border",
                                                "bg-elevated text-foreground border-border"
                                            )}>
                                                {selectedItem.type.name.fr}
                                            </span>
                                            <span className="px-4 py-1.5 rounded-full text-caption font-semibold bg-surface text-muted-foreground">
                                                Niveau {selectedItem.level}
                                            </span>
                                            <span className="ml-auto text-caption font-semibold text-muted-foreground tracking-wide flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                                                Encyclopédie
                                            </span>
                                        </div>
                                        <h1 className="text-3xl font-black text-foreground tracking-tight mb-3">{selectedItem.name.fr}</h1>
                                        {selectedItem.description?.fr && (
                                            <p className="text-muted-foreground text-body-sm leading-relaxed italic border-l-2 border-border pl-4">{selectedItem.description.fr}</p>
                                        )}

                                        {detailMetaChips.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-4">
                                                {detailMetaChips.map((chip) => (
                                                    <span
                                                        key={chip.key}
                                                        className="px-3 py-1 rounded-lg text-caption font-semibold bg-surface text-muted-foreground border border-border"
                                                    >
                                                        {chip.label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 mt-8">
                                            <a
                                                href={`https://www.dofusdb.fr/fr/database/item/${selectedItem.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "px-6 py-3 rounded-2xl text-caption font-semibold flex items-center gap-2 transition-colors",
                                                    "bg-gold/15 hover:bg-gold/25 text-gold border border-gold/30"
                                                )}
                                            >
                                                Consulter la fiche <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {(detailBlocks.showEffects || detailBlocks.showRecipe) ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto custom-scrollbar pr-4 pb-6">
                                    {detailBlocks.showEffects && (
                                    <div className="space-y-6">
                                    {/* Stats Card */}
                                        <div className="p-8 rounded-2xl bg-surface border border-border h-fit">
                                            <div className="flex items-center gap-3 mb-8">
                                                {/* Asset officiel Dofus crossed-swords */}
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src="/assets/dofus/game-icons/crossed-swords.png"
                                                    alt="Effets & Bonus"
                                                    className="h-5 w-5 object-contain shrink-0"
                                                />
                                                <h4 className="text-caption font-semibold text-muted-foreground">Effets & Bonus</h4>
                                            </div>
                                            <div className="space-y-4">
                                                {(selectedItem.effects || selectedItem.possibleEffects || []).length > 0 ? (
                                                    (selectedItem.effects || selectedItem.possibleEffects || []).map((fx: any, i: number) => {
                                                        const range = parseEffectRange(fx);
                                                        const numColor = getDofusStatNumberColor(
                                                            range,
                                                            fx.characteristic,
                                                            fx.effectId || fx.int_id,
                                                            fx.int_name
                                                        );
                                                        const valueStr = formatEffectDisplay(fx);
                                                        return (
                                                            <div key={i} className="flex items-center justify-between group/fx py-1 border-b border-border/20 last:border-0">
                                                                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                                                                    <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border shadow-xs">
                                                                        <StatIcon characteristicId={fx.characteristic} effectId={fx.effectId || fx.int_id} charCode={fx.int_name} />
                                                                    </div>
                                                                    <span className="text-body-sm font-bold text-foreground truncate">{getStatLabel(fx)}</span>
                                                                </div>
                                                                <span
                                                                    className="text-body-sm font-black tabular-nums shrink-0 ml-2"
                                                                    style={{ color: numColor }}
                                                                >
                                                                    {valueStr}
                                                                </span>
                                                            </div>
                                                        );
                                                    })
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    )}
                                    {detailBlocks.showRecipe && (
                                    <div className="space-y-6">
                                    {/* Recipe Card */}
                                        <div className="p-8 rounded-2xl bg-surface border border-border">
                                            <div className="flex items-center justify-between gap-3 mb-8">
                                                <div className="flex items-center gap-3">
                                                    {/* Asset officiel Dofus métier ou marteau */}
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={currentJobIcon || "/assets/dofus/game-icons/hammer.png"}
                                                        alt="Fabrication"
                                                        className="h-5 w-5 object-contain shrink-0"
                                                    />
                                                    <h4 className="text-caption font-semibold text-muted-foreground">
                                                        Fabrication {recipe?.job?.name?.fr ? `• ${recipe.job.name.fr}` : ""}
                                                    </h4>
                                                </div>
                                                {loadingRecipe && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        <span>Chargement...</span>
                                                    </div>
                                                )}
                                            </div>

                                            {recipe ? (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {recipe.ingredients.map((ing, i) => {
                                                            const qty = recipe.quantities?.[i] || 1;
                                                            const isCopied = copiedIngredient === ing.name.fr;
                                                            return (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={(e) => handleCopyIngredient(ing.name.fr, e)}
                                                                    aria-label={`Copier ${ing.name.fr}`}
                                                                    className={cn(
                                                                        "w-full flex items-center justify-between gap-4 p-3 rounded-2xl bg-surface border transition-colors select-none text-left",
                                                                        isCopied
                                                                            ? "border-success/40 bg-success/10"
                                                                            : "border-border hover:border-border-strong hover:bg-elevated"
                                                                    )}
                                                                >
                                                                    <span className="flex items-center gap-3 min-w-0">
                                                                        <span className="w-10 h-10 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border/50">
                                                                            <Image
                                                                                src={getItemImageUrl(ing.id, ing.img)}
                                                                                alt=""
                                                                                width={28}
                                                                                height={28}
                                                                                unoptimized
                                                                                onError={handleItemImageError}
                                                                            />
                                                                        </span>
                                                                        <span className="min-w-0">
                                                                            <span className="text-label font-bold text-foreground line-clamp-2 leading-snug block">
                                                                                {ing.name.fr}
                                                                            </span>
                                                                            <span className="text-[10px] text-muted-foreground/80 font-medium block">
                                                                                {isCopied ? "Copié !" : "Cliquer pour copier"}
                                                                            </span>
                                                                        </span>
                                                                    </span>
                                                                    <span className="flex items-center gap-2 shrink-0">
                                                                        {isCopied ? (
                                                                            <Check className="w-3.5 h-3.5 text-success" />
                                                                        ) : (
                                                                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                                                        )}
                                                                        <span className="text-caption font-black text-gold bg-gold/10 px-2.5 py-1 rounded-lg border border-gold/30">
                                                                            x{qty}
                                                                        </span>
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : loadingRecipe ? (
                                                <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                                    <Loader2 className="w-8 h-8 animate-spin" />
                                                    <p className="text-caption font-bold uppercase tracking-wider">Récupération de la recette...</p>
                                                </div>
                                            ) : (
                                                <div className="py-20 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center opacity-20 capitalize">
                                                    <PackageOpen className="h-10 w-10 mb-3" />
                                                    <p className="text-caption font-medium">Pas de recette disponible</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    )}
                                </div>
                                ) : (
                                <p className="text-xs text-muted-foreground">Objet simple — sans effet ni recette. Voir la fiche DofusDB pour l&apos;obtention.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

