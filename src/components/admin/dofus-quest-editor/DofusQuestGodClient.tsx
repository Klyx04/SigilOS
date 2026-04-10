"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { compileDofusChain, updateDofusCategory } from "@/server/actions/dofus-quest-admin-actions";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ChevronDown,
    ChevronRight,
    MapPin,
    BookOpen,
    ExternalLink,
    AlertTriangle,
    Check,
    Database,
    Layers,
    Package,
    ListChecks,
    Trophy,
    Terminal,
    Skull,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { runV3Siphoner } from "@/server/actions/dofus-v3-actions";
import { RefreshCcw, Share2, Zap } from "lucide-react";

interface DofusStats {
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
    filterCategory: string;
    filterSubCategory: string | null;
    color: string | null;
    chainCount: number;
    questCount: number;
    withCoords: number;
    withItems: number;
    dungeons: number;
    minLevel: number | null;
    maxLevel: number | null;
    chains: {
        id: string;
        sectionName: string;
        chainOrder: number;
        entries: any[];
    }[];
}

export function DofusQuestGodClient({ dofusItems }: { dofusItems: DofusStats[] }) {
    const [expandedDofus, setExpandedDofus] = useState<string | null>(null);
    const [expandedChain, setExpandedChain] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleV3Siphon = (slug: string) => {
        startTransition(async () => {
            const toastId = toast.loading(`Siphonnage V3 de ${slug} (Tougli + DPN + DB)...`);
            const res = await runV3Siphoner(slug);
            if (res.success) {
                toast.success(`Migration V3 terminée pour ${slug} !`, { id: toastId });
            } else {
                toast.error(res.error || "Erreur migration", { id: toastId });
            }
        });
    };

    const handleCompile = (slug: string) => {
        startTransition(async () => {
            const toastId = toast.loading(`Compilation de ${slug} en cours...`);
            const res = await compileDofusChain(slug);
            if (res.success) {
                toast.success(`Le Dofus ${slug} a été compilé !`, { id: toastId });
            } else {
                toast.error(res.error || "Erreur compilation", { id: toastId });
            }
        });
    };

    const handleCategoryChange = (id: string, category: string, currentSub: string | null) => {
        startTransition(async () => {
            const toastId = toast.loading("Mise à jour de la catégorie...");
            // Reset subcategory if we change the main category
            const newSub = category === "Primordiaux" && currentSub ? currentSub : 
                           (category === "Primordiaux" ? "6/6" : null);

            const res = await updateDofusCategory(id, category, newSub);
            if (res.success) toast.success("Catégorie mise à jour", { id: toastId });
            else toast.error(res.error || "Erreur", { id: toastId });
        });
    };

    const handleSubCategoryChange = (id: string, category: string, newSub: string) => {
        startTransition(async () => {
            const toastId = toast.loading("Mise à jour...");
            const res = await updateDofusCategory(id, category, newSub);
            if (res.success) toast.success("Mise à jour effectuée", { id: toastId });
            else toast.error(res.error || "Erreur", { id: toastId });
        });
    };

    return (
        <div className="space-y-6">
            {/* Global Sync Header */}
            <div className="flex items-center justify-between bg-zinc-950/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl mb-4 group">
                <div>
                    <h2 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-400" />
                        Actions Globales
                    </h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Dernière étape du déploiement : synchronisation massive</p>
                </div>
                <Button
                    variant="default"
                    size="lg"
                    disabled={isPending}
                    onClick={() => { 
                        startTransition(async () => {
                            const toastId = toast.loading(`Lancement de la synchronisation globale...`);
                            const { seedDofusData } = await import("@/server/actions/dofus-quest-actions");
                            const res = await seedDofusData("GOD");
                            if (res.success) toast.success("Base de données synchronisée !", { id: toastId });
                            else toast.error("Erreur de synchronisation", { id: toastId });
                        });
                    }}
                    className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs tracking-widest transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 px-8"
                >
                    <RefreshCcw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                    Synchroniser toute la base (Seed)
                </Button>
            </div>

            {dofusItems.length === 0 && (
                <div className="text-center py-24 bg-zinc-950/50 border border-white/5 rounded-3xl">
                    <AlertTriangle className="w-16 h-16 mx-auto text-amber-500/30 mb-6" />
                    <p className="text-zinc-400 text-xl font-black italic">Aucune donnée de quête détectée.</p>
                    <p className="text-zinc-600 text-sm mt-3 max-w-md mx-auto">
                        La base de données est vide. Exécutez le compilateur pour alimenter le gestionnaire.
                    </p>
                    <div className="mt-8">
                        <code className="bg-black/50 border border-white/10 px-4 py-2 rounded-xl text-emerald-400 font-mono text-sm">
                            npx tsx scripts/dofus-compiler.ts --dofus argent
                        </code>
                    </div>
                </div>
            )}

            {dofusItems.map(dofus => {
                const isExpanded = expandedDofus === dofus.id;
                const coveragePct = dofus.questCount > 0 ? Math.round((dofus.withCoords / dofus.questCount) * 100) : 0;
                const DOFUS_IMG_MAP: Record<string, string> = {
                    "abyssal":              "Dofus_Abyssal.png",
                    "argent":               "Dofus_Argent\u00e9.png",
                    "argente-scintillant":  "Dofus_Argente_Scintillant.png",
                    "cacao":                "Dofus_Cacao.png",
                    "cawotte":              "Dofus_Cawotte.png",
                    "des-glaces":           "Dofus_Des_Glaces.png",
                    "dokoko":               "Dofus_Dokoko.png",
                    "dolmanax":             "Dofus_Dolmanax.png",
                    "domakuro":             "Dofus_Domakuro.png",
                    "dorigami":             "Dofus_Dorigami.png",
                    "du-cauchemar":         "Dofus_Du_Cauchemar.png",
                    "ebene":                "Dofus_Ebene.png",
                    "emeraude":             "Dofus_Emeraude.png",
                    "forgelave":            "Dofus_Forgelave.png",
                    "ivoire":               "Dofus_Ivoire.png",
                    "nebuleux":             "Dofus_Nebuleux.png",
                    "ocre":                 "Dofus_Ocre.png",
                    "pourpre":              "Dofus_Pourpre.png",
                    "sylvestre":            "Dofus_Sylvestre.png",
                    "tachete":              "Dofus_Tachet\u00e9.png",
                    "turquoise":            "Dofus_Turquoise.png",
                    "veilleur":             "Dofus_Veilleur.png",
                    "vulbis":               "Dofus_Vulbis.png",
                };
                const localImg = `/module-dofus/${DOFUS_IMG_MAP[dofus.slug] ?? "Dofus_Abyssal.png"}`;

                return (
                    <div key={dofus.id} className="border border-white/5 rounded-3xl overflow-hidden bg-zinc-950/40 backdrop-blur-xl shadow-2xl transition-all duration-500 hover:border-white/10">
                        {/* Dofus header card */}
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setExpandedDofus(isExpanded ? null : dofus.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setExpandedDofus(isExpanded ? null : dofus.id);
                                }
                            }}
                            className="w-full flex items-center justify-between gap-8 px-10 py-8 hover:bg-white/[0.03] transition-all text-left group cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="relative flex items-center gap-10 flex-1 min-w-0">
                                {/* Dofus icon with premium glow */}
                                <div className="relative group/icon shrink-0">
                                    <div className={`absolute inset-0 blur-3xl opacity-0 group-hover/icon:opacity-30 transition-opacity bg-white rounded-full`} />
                                    <img
                                        src={localImg}
                                        alt={dofus.name}
                                        className="relative w-24 h-24 rounded-[3rem] object-contain bg-black/60 p-3 shadow-2xl border border-white/10 group-hover/icon:scale-105 transition-transform duration-500"
                                        onError={(e: any) => { e.target.onerror = null; e.target.src = dofus.imageUrl ?? ''; }}
                                    />
                                </div>

                                <div className="flex flex-col gap-3 min-w-0">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-3xl font-black text-white italic tracking-tighter drop-shadow-lg truncate">
                                            {dofus.name}
                                        </h3>
                                        <Badge className="bg-white/5 text-zinc-500 border-white/5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border">
                                            {dofus.slug}
                                        </Badge>
                                        {dofus.questCount === 0 && (
                                            <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/10 uppercase font-black text-[9px]">Vide</Badge>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                                        <div className="flex items-center gap-2.5 text-zinc-500/80">
                                            <Trophy className="w-4 h-4" />
                                            <span className="text-[11px] font-black uppercase tracking-[0.1em] tabular-nums">{dofus.chainCount} succès</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-zinc-500/80">
                                            <Database className="w-4 h-4" />
                                            <span className="text-[11px] font-black uppercase tracking-[0.1em] tabular-nums">{dofus.questCount} quêtes</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-emerald-500/60">
                                            <MapPin className="w-4 h-4" />
                                            <span className="text-[11px] font-black uppercase tracking-[0.1em] tabular-nums">{dofus.withCoords} coords</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-rose-500/60">
                                            <Skull className="w-4 h-4" />
                                            <span className="text-[11px] font-black uppercase tracking-[0.1em] tabular-nums">
                                                {(() => {
                                                    const djs = (dofus.chains || []).flatMap(c => (c.entries || []).flatMap(e => (e.dungeonsRequired ?? []) as any[]));
                                                    const unique = new Set(djs.map(d => d.id || d.name));
                                                    return unique.size;
                                                })()} boss
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Coverage meter */}
                            <div className="relative flex items-center gap-8 shrink-0">
                                <div className="flex flex-col items-end gap-2 text-right">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-2xl font-black tabular-nums italic drop-shadow-md ${coveragePct === 100 ? "text-emerald-400" : coveragePct > 75 ? "text-sky-400" : "text-amber-500"}`}>
                                            {coveragePct}%
                                        </span>
                                        <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pt-1">Prêt</span>
                                    </div>
                                    <div className="w-32 h-1.5 bg-black/40 rounded-full border border-white/5 overflow-hidden p-0.5">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${coveragePct === 100 ? 'from-emerald-600 to-emerald-400' : 'from-amber-600 to-amber-400'}`}
                                            style={{ width: `${coveragePct}%` }}
                                        />
                                    </div>
                                </div>
                                <div className={`p-3 rounded-2xl bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-500 ${isExpanded ? "rotate-180 bg-white/10" : ""}`}>
                                    <ChevronDown className="w-6 h-6 text-zinc-400" />
                                </div>
                            </div>
                        </div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                    className="overflow-hidden bg-black/20"
                                >
                                    <div className="px-8 pb-8 space-y-8 border-t border-white/5 pt-6">
                                        {/* MANAGEMENT BAR (Unified Header) */}
                                        <div className="flex flex-wrap items-center justify-between gap-6 bg-zinc-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md">
                                            <div className="flex items-center gap-8">
                                                {/* Recommended Level */}
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em]">Lvl recommandé</span>
                                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                                                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                                        <span className="text-sm font-black text-white italic tabular-nums">
                                                            {dofus.minLevel || dofus.maxLevel ? `${dofus.minLevel ?? "?"} – ${dofus.maxLevel ?? "?"}` : "N/A"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Separator */}
                                                <div className="h-10 w-px bg-white/5" />

                                                {/* Category Selection */}
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em]">Classification</span>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={dofus.filterCategory}
                                                            onValueChange={(val) => handleCategoryChange(dofus.id, val, dofus.filterSubCategory)}
                                                        >
                                                            <SelectTrigger className="h-10 min-w-[160px] text-xs font-black bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all">
                                                                <SelectValue placeholder="Catégorie" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-zinc-950 border-white/10 text-white font-bold">
                                                                <SelectItem value="Primordiaux">Primordiaux</SelectItem>
                                                                <SelectItem value="Prérequis Sylvestre">Prérequis Sylvestre</SelectItem>
                                                                <SelectItem value="Autres">Autres</SelectItem>
                                                            </SelectContent>
                                                        </Select>

                                                        {dofus.filterCategory === "Primordiaux" && (
                                                            <Select
                                                                value={dofus.filterSubCategory || "6/6"}
                                                                onValueChange={(val) => handleSubCategoryChange(dofus.id, dofus.filterCategory, val)}
                                                            >
                                                                <SelectTrigger className="h-10 min-w-[80px] text-xs font-black bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all">
                                                                    <SelectValue placeholder="6/6" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-zinc-950 border-white/10 text-white font-bold">
                                                                    <SelectItem value="4/6">4/6</SelectItem>
                                                                    <SelectItem value="6/6">6/6</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <Button 
                                                disabled={isPending}
                                                onClick={(e) => { e.stopPropagation(); handleCompile(dofus.slug); }}
                                                className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white h-12 px-8 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.1)] active:scale-95 group/btn"
                                            >
                                                <Zap className={`w-4 h-4 mr-3 ${isPending ? 'animate-pulse' : 'group-hover/btn:animate-bounce'}`} />
                                                Compiler & Seed la chaîne
                                            </Button>
                                        </div>

                                        {/* Global Summary Stats */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                                            {/* DUNGEONS SYNTESIS */}
                                            <div className="relative group/card bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden flex flex-col">
                                                <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                <div className="relative flex items-center justify-between mb-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                                                            <Trophy className="w-5 h-5 text-rose-500" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <h4 className="text-white font-black italic uppercase tracking-tighter">Synthèse Donjons</h4>
                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Trophées de Boss requis</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="relative flex flex-wrap gap-5">
                                                    {(() => {
                                                        const dungeons = (dofus.chains || []).flatMap(c => (c.entries || []).flatMap(e => (e.dungeonsRequired ?? []) as any[]));
                                                        const uniqueDungeons = Array.from(new Map(dungeons.map(d => [d.name, d])).values());
                                                        
                                                        if (uniqueDungeons.length === 0) return (
                                                                <div className="w-full py-10 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                                                                    <span className="text-zinc-600 text-sm font-bold italic tracking-wide">Zéro donjon sur cette route</span>
                                                                </div>
                                                            );

                                                        return uniqueDungeons.map((dj, i) => (
                                                            <div key={i} className="group/boss relative flex flex-col items-center gap-3 transition-all hover:-translate-y-1">
                                                                <div className="relative w-20 h-20 rounded-[2rem] bg-zinc-950 border border-white/10 group-hover/boss:border-rose-500/50 overflow-hidden shadow-2xl transition-all p-1 bg-gradient-to-tr from-black to-zinc-900">
                                                                    {dj.img ? (
                                                                        <img 
                                                                            src={dj.img} 
                                                                            className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] group-hover/boss:scale-110 transition-transform" 
                                                                            alt={dj.name}
                                                                            loading="lazy"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-rose-500/20">
                                                                            <Trophy className="w-10 h-10" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter text-center max-w-[80px] line-clamp-2 leading-tight group-hover/boss:text-rose-400">
                                                                    {dj.name.replace("Donjon du ", "").replace("Donjon de la ", "").replace("Donjon des ", "").replace("Donjon ", "")}
                                                                </span>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>

                                            {/* RESOURCES SYNTESIS */}
                                            <div className="relative group/card bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden flex flex-col">
                                                <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                <div className="relative flex items-center justify-between mb-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                            <Package className="w-5 h-5 text-amber-500" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <h4 className="text-white font-black italic uppercase tracking-tighter">Coffre de Quêtes</h4>
                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Inventaire complet nécessaire</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <ScrollArea className="h-[320px] w-full">
                                                    <div className="relative grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-3">
                                                        {(() => {
                                                            const itemMap = new Map<string, { name: string; amount: number; img: string | null; id: number }>();
                                                            (dofus.chains || []).forEach(c => {
                                                                (c.entries || []).forEach(e => {
                                                                    const items = e.itemsRequired as any[] || [];
                                                                    items.forEach(it => {
                                                                        const key = it.id || it.dofusdbId || it.name;
                                                                        const existing = itemMap.get(String(key));
                                                                        if (existing) existing.amount += it.amount;
                                                                        else itemMap.set(String(key), { 
                                                                            name: it.name, 
                                                                            amount: it.amount, 
                                                                            img: it.img, 
                                                                            id: it.id || it.dofusdbId 
                                                                        });
                                                                    });
                                                                });
                                                            });
                                                            const totalItems = Array.from(itemMap.values());
                                                            
                                                            if (totalItems.length === 0) return (
                                                                <div className="col-span-full py-10 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                                                                    <span className="text-zinc-600 text-sm font-bold italic tracking-wide">Aucune ressource répertoriée</span>
                                                                </div>
                                                            );

                                                            return totalItems.map((it, i) => (
                                                                <a 
                                                                    key={i} 
                                                                    href={it.id && it.id > 0 ? `https://dofusdb.fr/fr/database/item/${it.id}` : "#"}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="group/item relative aspect-square rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center justify-center p-2 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all cursor-alias"
                                                                    title={it.name}
                                                                >
                                                                    <div className="relative w-full h-full flex items-center justify-center">
                                                                        {it.img ? (
                                                                            <img src={it.img} className="w-full h-full object-contain filter group-hover/item:scale-110 transition-transform" alt={it.name} loading="lazy" />
                                                                        ) : (
                                                                            <Package className="w-6 h-6 text-zinc-800" />
                                                                        )}
                                                                        <div className="absolute -bottom-2 -right-2 bg-zinc-950 border border-white/10 rounded-md px-1.5 py-0.5 shadow-2xl z-10 group-hover/item:border-amber-500/30">
                                                                            <span className="text-[10px] font-black text-white tabular-nums leading-none">
                                                                                {it.amount > 999 ? `${(it.amount/1000).toFixed(1)}k` : it.amount}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </a>
                                                            ));
                                                        })()}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        </div>

                                        {/* Chain list */}
                                        {(dofus.chains || []).map(chain => {
                                            const chainExpanded = expandedChain === chain.id;
                                            const entriesWithCoords = (chain.entries || []).filter(e => e.coords != null).length;
                                            const missingItems = (chain.entries || []).filter(e => !e.itemsRequired || e.itemsRequired.length === 0);

                                            return (
                                                <div key={chain.id} className="border border-white/5 rounded-2xl overflow-hidden bg-zinc-900/30">
                                                    <button
                                                        onClick={() => setExpandedChain(chainExpanded ? null : chain.id)}
                                                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors text-left group/chain"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-1.5 rounded-lg bg-white/5 text-zinc-600 group-hover/chain:text-white transition-colors ${chainExpanded ? "rotate-90" : ""}`}>
                                                                <ChevronRight className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-base font-black text-zinc-200 italic">{chain.sectionName}</span>
                                                            <div className="h-4 w-px bg-white/10 mx-2" />
                                                            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">{(chain.entries || []).length} étapes</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-[11px] text-zinc-500 font-bold tabular-nums">
                                                                {entriesWithCoords}/{(chain.entries || []).length} localisations
                                                            </span>
                                                            {chainExpanded ? <ChevronDown className="w-4 h-4 text-zinc-700" /> : <ChevronRight className="w-4 h-4 text-zinc-700" />}
                                                        </div>
                                                    </button>

                                                    <AnimatePresence>
                                                        {chainExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0 }}
                                                                animate={{ height: "auto" }}
                                                                exit={{ height: 0 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="border-t border-white/5 p-2">
                                                                    <div className="overflow-x-auto rounded-xl border border-white/5">
                                                                        <table className="w-full text-[12px] border-separate border-spacing-y-1.5 px-2">
                                                                            <thead>
                                                                                <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                                                                    <th className="text-left px-5 py-4">#</th>
                                                                                    <th className="text-left px-4 py-4">Quête</th>
                                                                                    <th className="text-left px-4 py-4">Lien DB</th>
                                                                                    <th className="text-center px-4 py-4">Lvl</th>
                                                                                    <th className="text-left px-4 py-4">Zone / PNJ</th>
                                                                                    <th className="text-left px-4 py-4">Objectifs</th>
                                                                                    <th className="text-center px-4 py-4">Besoin</th>
                                                                                    <th className="text-center px-4 py-4">Actions</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {(chain.entries || []).map((entry, idx) => {
                                                                                    const coords = entry.coords as any;
                                                                                    const items = (entry.itemsRequired ?? []) as any[];
                                                                                    const objectives = (entry.objectives ?? []) as string[];
                                                                                    const hasIssue = !entry.dofusdbId || !coords;
                                                                                    const isDungeon = entry.isDungeon || (entry.dungeonsRequired && (entry.dungeonsRequired as any[]).length > 0);

                                                                                    return (
                                                                                        <tr key={entry.id} className={`group/row transition-all duration-300 ${hasIssue ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]" : "bg-white/[0.02] hover:bg-white/[0.05]"} rounded-xl shadow-sm`}>
                                                                                            <td className="px-5 py-4 first:rounded-l-2xl last:rounded-r-2xl text-zinc-600 font-black tabular-nums border-y border-l border-white/5 group-hover/row:border-white/10">{idx + 1}</td>
                                                                                            <td className="px-4 py-4 border-y border-white/5 group-hover/row:border-white/10">
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className={`w-2 h-2 rounded-full ${isDungeon ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-indigo-500/40'}`} />
                                                                                                    <div className="flex flex-col">
                                                                                                       <span className="font-black text-white italic truncate max-w-[200px] leading-none mb-1">{entry.name}</span>
                                                                                                       {isDungeon && <span className="text-[10px] font-black text-rose-400 uppercase tracking-tighter">Instance Donjon</span>}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-4 py-4 border-y border-white/5 group-hover/row:border-white/10">
                                                                                                {entry.dofusdbId ? (
                                                                                                    <a
                                                                                                        href={`https://dofusdb.fr/fr/database/quest/${entry.dofusdbId}`}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500 hover:text-white transition-all font-black text-[10px] tracking-wide"
                                                                                                    >
                                                                                                        {entry.dofusdbId}
                                                                                                        <ExternalLink className="w-3 h-3" />
                                                                                                    </a>
                                                                                                ) : (
                                                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black italic text-[10px]">
                                                                                                       <AlertTriangle className="w-3 h-3" />
                                                                                                       MANQUANT
                                                                                                    </span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-4 text-zinc-400 text-center font-black border-y border-white/5 group-hover/row:border-white/10 tabular-nums">{entry.level ?? "—"}</td>
                                                                                            <td className="px-4 py-4 border-y border-white/5 group-hover/row:border-white/10">
                                                                                                {coords ? (
                                                                                                    <div className="flex items-start gap-3">
                                                                                                       <div className="flex flex-col">
                                                                                                           <div className="flex items-center gap-1.5">
                                                                                                               <span className="text-emerald-400 font-black tabular-nums tracking-wider text-sm bg-emerald-500/5 px-2 py-0.5 rounded-md">[{coords.x}, {coords.y}]</span>
                                                                                                           </div>
                                                                                                           <span className="text-[10px] font-bold text-zinc-500 mt-1 flex items-center gap-1 max-w-[140px] truncate">
                                                                                                               <MapPin className="w-2.5 h-2.5" />
                                                                                                               {entry.npcSubArea ?? entry.zone}
                                                                                                           </span>
                                                                                                       </div>
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <span className="text-zinc-700 italic font-bold">Inconnu</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-4 border-y border-white/5 group-hover/row:border-white/10">
                                                                                                {objectives.length > 0 ? (
                                                                                                    <Popover>
                                                                                                        <PopoverTrigger asChild>
                                                                                                            <button className="flex items-center gap-2 group/pop hover:bg-white/5 px-3 py-1.5 rounded-xl border border-transparent hover:border-white/10 transition-all">
                                                                                                                <ListChecks className="w-4 h-4 text-indigo-400 group-hover/pop:scale-110 transition-transform" />
                                                                                                                <span className="text-indigo-200 font-black uppercase text-[10px] tracking-widest">{objectives.length} étapes</span>
                                                                                                            </button>
                                                                                                        </PopoverTrigger>
                                                                                                        <PopoverContent className="w-80 bg-zinc-950/90 border-white/10 p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl rounded-3xl">
                                                                                                            <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-4 flex items-center justify-between">
                                                                                                                <div className="flex items-center gap-2">
                                                                                                                   <ListChecks className="w-3.5 h-3.5" />
                                                                                                                   Guide de Quête
                                                                                                                </div>
                                                                                                                <span className="bg-white/5 px-2 py-0.5 rounded text-[9px]">{entry.name}</span>
                                                                                                            </div>
                                                                                                            <div className="space-y-3">
                                                                                                                {objectives.map((obj, i) => (
                                                                                                                    <div key={i} className="flex gap-3 text-[11px] leading-normal text-zinc-400 group/obj">
                                                                                                                        <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 font-black text-indigo-400 text-[9px]">
                                                                                                                           {i+1}
                                                                                                                        </div>
                                                                                                                        <span className="pt-0.5">{obj.replace(/\{npc,\d+\}/g, "NPC").replace(/\{item,\d+\}/g, "Objet")}</span>
                                                                                                                    </div>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        </PopoverContent>
                                                                                                    </Popover>
                                                                                                ) : (
                                                                                                    <span className="text-zinc-800 italic font-bold ml-3">Aucun détail</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-4 border-y border-white/5 group-hover/row:border-white/10 text-center">
                                                                                                {items.length > 0 ? (
                                                                                                    <div className="flex -space-x-3 justify-center group-hover/row:space-x-1 transition-all">
                                                                                                        {items.slice(0, 4).map((item, i) => (
                                                                                                            <div 
                                                                                                                key={i} 
                                                                                                                className="w-10 h-10 rounded-xl bg-zinc-900 border-2 border-white/5 overflow-hidden flex items-center justify-center bg-black/60 p-1.5 shadow-xl hover:border-amber-500/50 hover:scale-110 transition-all z-[1]"
                                                                                                                title={`${item.amount}x ${item.name}`}
                                                                                                                style={{ zIndex: 10 - i }}
                                                                                                            >
                                                                                                                {item.img ? <img src={item.img} className="w-full h-full object-contain" /> : <Package className="w-5 h-5 text-zinc-700" />}
                                                                                                            </div>
                                                                                                        ))}
                                                                                                        {items.length > 4 && (
                                                                                                            <div className="w-10 h-10 rounded-xl bg-zinc-800 border-2 border-white/5 flex items-center justify-center text-[10px] font-black text-zinc-500 z-0">
                                                                                                                +{items.length - 4}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <div className="w-10 h-10 mx-auto rounded-xl border-2 border-dashed border-white/5 flex items-center justify-center">
                                                                                                       <Check className="w-4 h-4 text-emerald-500/20" />
                                                                                                    </div>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-4 border-y border-r border-white/5 group-hover/row:border-white/10 first:rounded-l-2xl last:rounded-r-2xl text-center">
                                                                                                <div className="flex items-center justify-center">
                                                                                                    <Button 
                                                                                                        variant="ghost" 
                                                                                                        size="icon" 
                                                                                                        className="h-10 w-10 rounded-xl hover:bg-white/10 text-zinc-600 hover:text-white transition-all hover:scale-110 active:scale-90"
                                                                                                        onClick={() => {
                                                                                                            if (entry.externalRef) {
                                                                                                                window.open(entry.externalRef, '_blank');
                                                                                                            } else {
                                                                                                                const searchUrl = `https://www.dofuspourlesnoobs.com/search-results.html?q=${encodeURIComponent(entry.name)}`;
                                                                                                                window.open(searchUrl, '_blank');
                                                                                                            }
                                                                                                        }}
                                                                                                    >
                                                                                                        <BookOpen className="w-4 h-4" />
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}

        </div>
    );
}
