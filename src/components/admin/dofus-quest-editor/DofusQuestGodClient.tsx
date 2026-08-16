"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { compileDofusChain, updateDofusCategory, upsertQuestEntry } from "@/server/actions/dofus-quest-admin-actions";
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
    Edit2,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { runV3Siphoner } from "@/server/actions/dofus-v3-actions";
import { RefreshCcw, Share2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
    const router = useRouter();
    const [expandedDofus, setExpandedDofus] = useState<string | null>(null);
    const [expandedChain, setExpandedChain] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [editingEntry, setEditingEntry] = useState<any | null>(null);
    const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);

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
            <div className="flex items-center justify-between bg-background/40 backdrop-blur-xl border border-border p-6 rounded-3xl mb-4 group">
                <div>
                    <h2 className="text-xl font-black text-foreground italic tracking-tighter uppercase flex items-center gap-2">
                        <Database className="w-5 h-5 text-info" />
                        Actions Globales
                    </h2>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Dernière étape du déploiement : synchronisation massive</p>
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
                    className="h-12 rounded-2xl bg-info hover:bg-info text-info-foreground font-black uppercase text-xs tracking-widest transition-all   active:scale-95 px-8"
                >
                    <RefreshCcw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                    Synchroniser toute la base (Seed)
                </Button>
            </div>

            {dofusItems.length === 0 && (
                <div className="text-center py-24 bg-background/50 border border-border rounded-3xl">
                    <AlertTriangle className="w-16 h-16 mx-auto text-warning/30 mb-6" />
                    <p className="text-muted-foreground text-xl font-black italic">Aucune donnée de quête détectée.</p>
                    <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
                        La base de données est vide. Exécutez le compilateur pour alimenter le gestionnaire.
                    </p>
                    <div className="mt-8">
                        <code className="bg-black/50 border border-border px-4 py-2 rounded-xl text-success font-mono text-sm">
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
                    "dofoozbz":             "Dofus_dofoozbz.png",
                };
                const localImg = `/module-dofus/${DOFUS_IMG_MAP[dofus.slug] ?? "Dofus_Abyssal.png"}`;

                return (
                    <div key={dofus.id} className="border border-border rounded-3xl overflow-hidden bg-background/40 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-border">
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
                            className="w-full flex items-center justify-between gap-8 px-10 py-8 hover:bg-surface transition-all text-left group cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="relative flex items-center gap-10 flex-1 min-w-0">
                                {/* Dofus icon with premium glow */}
                                <div className="relative group/icon shrink-0">
                                    <div className={`absolute inset-0 blur-3xl opacity-0 group-hover/icon:opacity-30 transition-opacity bg-background rounded-full`} />
                                    <img
                                        src={localImg}
                                        alt={dofus.name}
                                        className="relative w-24 h-24 rounded-[3rem] object-contain bg-black/60 p-3 shadow-2xl border border-border group-hover/icon:scale-105 transition-transform duration-300"
                                        onError={(e: any) => { e.target.onerror = null; e.target.src = dofus.imageUrl ?? ''; }}
                                    />
                                </div>

                                <div className="flex flex-col gap-3 min-w-0">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-3xl font-black text-foreground italic tracking-tighter drop-shadow-lg truncate">
                                            {dofus.name}
                                        </h3>
                                        <Badge className="bg-surface text-muted-foreground border-border text-caption font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border">
                                            {dofus.slug}
                                        </Badge>
                                        {dofus.questCount === 0 && (
                                            <Badge className="bg-danger/10 text-danger border-danger/10 uppercase font-black text-caption">Vide</Badge>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                                        <div className="flex items-center gap-2.5 text-muted-foreground/80">
                                            <Trophy className="w-4 h-4" />
                                            <span className="text-caption font-black uppercase tracking-[0.1em] tabular-nums">{dofus.chainCount} succès</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-muted-foreground/80">
                                            <Database className="w-4 h-4" />
                                            <span className="text-caption font-black uppercase tracking-[0.1em] tabular-nums">{dofus.questCount} quêtes</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-success/60">
                                            <MapPin className="w-4 h-4" />
                                            <span className="text-caption font-black uppercase tracking-[0.1em] tabular-nums">{dofus.withCoords} coords</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-danger/60">
                                            <Skull className="w-4 h-4" />
                                            <span className="text-caption font-black uppercase tracking-[0.1em] tabular-nums">
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
                                        <span className={`text-2xl font-black tabular-nums italic drop-shadow-md ${coveragePct === 100 ? "text-success" : coveragePct > 75 ? "text-sky-400" : "text-warning"}`}>
                                            {coveragePct}%
                                        </span>
                                        <span className="text-caption text-muted-foreground font-black uppercase tracking-widest pt-1">Prêt</span>
                                    </div>
                                    <div className="w-32 h-1.5 bg-black/40 rounded-full border border-border overflow-hidden p-0.5">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${coveragePct === 100 ? 'from-success to-success' : 'from-warning to-warning'}`}
                                            style={{ width: `${coveragePct}%` }}
                                        />
                                    </div>
                                </div>
                                <div className={`p-3 rounded-2xl bg-surface border border-border group-hover:bg-surface group-hover:border-border-strong transition-all duration-300 ${isExpanded ? "rotate-180 bg-surface" : ""}`}>
                                    <ChevronDown className="w-6 h-6 text-muted-foreground" />
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
                                    <div className="px-8 pb-8 space-y-8 border-t border-border pt-6">
                                        {/* MANAGEMENT BAR (Unified Header) */}
                                        <div className="flex flex-wrap items-center justify-between gap-6 bg-surface/40 border border-border rounded-3xl p-5 backdrop-blur-md">
                                            <div className="flex items-center gap-8">
                                                {/* Recommended Level */}
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-caption font-black uppercase text-muted-foreground tracking-[0.2em]">Lvl recommandé</span>
                                                    <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-xl border border-border">
                                                        <Trophy className="w-3.5 h-3.5 text-warning" />
                                                        <span className="text-sm font-black text-foreground italic tabular-nums">
                                                            {dofus.minLevel || dofus.maxLevel ? `${dofus.minLevel ?? "?"} – ${dofus.maxLevel ?? "?"}` : "N/A"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Separator */}
                                                <div className="h-10 w-px bg-surface" />

                                                {/* Category Selection */}
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-caption font-black uppercase text-muted-foreground tracking-[0.2em]">Classification</span>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={dofus.filterCategory}
                                                            onValueChange={(val) => handleCategoryChange(dofus.id, val, dofus.filterSubCategory)}
                                                        >
                                                            <SelectTrigger className="h-10 min-w-[160px] text-xs font-black bg-surface border-border rounded-xl hover:bg-surface transition-all">
                                                                <SelectValue placeholder="Catégorie" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-background border-border text-foreground font-bold">
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
                                                                <SelectTrigger className="h-10 min-w-[80px] text-xs font-black bg-surface border-border rounded-xl hover:bg-surface transition-all">
                                                                    <SelectValue placeholder="6/6" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-background border-border text-foreground font-bold">
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
                                                className="bg-success/10 text-success border border-success/20 hover:bg-success hover:text-foreground h-12 px-8 rounded-2xl text-caption font-black uppercase tracking-widest transition-all  active:scale-95 group/btn"
                                            >
                                                <Zap className={`w-4 h-4 mr-3 ${isPending ? 'animate-pulse' : 'group-hover/btn:animate-bounce'}`} />
                                                Compiler & Seed la chaîne
                                            </Button>
                                        </div>

                                        {/* Chain list */}
                                        {(dofus.chains || []).map(chain => {
                                            const chainExpanded = expandedChain === chain.id;
                                            const entriesWithCoords = (chain.entries || []).filter(e => e.coords != null).length;
                                            const missingItems = (chain.entries || []).filter(e => !e.itemsRequired || e.itemsRequired.length === 0);

                                            return (
                                                <div key={chain.id} className="border border-border rounded-2xl overflow-hidden bg-surface/30">
                                                    <button
                                                        onClick={() => setExpandedChain(chainExpanded ? null : chain.id)}
                                                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface transition-colors text-left group/chain"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-1.5 rounded-lg bg-surface text-muted-foreground group-hover/chain:text-foreground transition-colors ${chainExpanded ? "rotate-90" : ""}`}>
                                                                <ChevronRight className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-base font-black text-foreground italic">{chain.sectionName}</span>
                                                            <div className="h-4 w-px bg-surface mx-2" />
                                                            <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest">{(chain.entries || []).length} étapes</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-caption text-muted-foreground font-bold tabular-nums">
                                                                {entriesWithCoords}/{(chain.entries || []).length} localisations
                                                            </span>
                                                            {chainExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
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
                                                                <div className="border-t border-border p-2">
                                                                    <div className="overflow-x-auto rounded-xl border border-border">
                                                                        <table className="w-full text-label border-separate border-spacing-y-1.5 px-2">
                                                                            <thead>
                                                                                <tr className="text-muted-foreground text-caption font-black uppercase tracking-[0.2em]">
                                                                                    <th className="text-left px-5 py-4">#</th>
                                                                                    <th className="text-left px-4 py-4">Quête</th>
                                                                                    <th className="text-left px-4 py-4">Lien DB</th>
                                                                                    <th className="text-center px-4 py-4">Lvl</th>
                                                                                    <th className="text-left px-4 py-4">Zone / PNJ</th>
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
                                                                                        <tr key={entry.id} className={`group/row transition-all duration-300 ${hasIssue ? "bg-warning/[0.03] hover:bg-warning/[0.06]" : "bg-surface hover:bg-surface"} rounded-xl shadow-sm`}>
                                                                                            <td className="px-5 py-4 first:rounded-l-2xl last:rounded-r-2xl text-muted-foreground font-black tabular-nums border-y border-l border-border group-hover/row:border-border">{idx + 1}</td>
                                                                                            <td className="px-4 py-4 border-y border-border group-hover/row:border-border">
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className={`w-2 h-2 rounded-full ${isDungeon ? 'bg-danger ' : 'bg-info/40'}`} />
                                                                                                    <div className="flex flex-col">
                                                                                                       <span className="font-black text-foreground italic truncate max-w-[200px] leading-none mb-1">{entry.name}</span>
                                                                                                       {isDungeon && <span className="text-caption font-black text-danger uppercase tracking-tighter">Instance Donjon</span>}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-4 py-4 border-y border-border group-hover/row:border-border">
                                                                                                {entry.dofusdbId ? (
                                                                                                    <a
                                                                                                        href={`https://dofusdb.fr/fr/database/quest/${entry.dofusdbId}`}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500 hover:text-foreground transition-all font-black text-caption tracking-wide"
                                                                                                    >
                                                                                                        {entry.dofusdbId}
                                                                                                        <ExternalLink className="w-3 h-3" />
                                                                                                    </a>
                                                                                                ) : (
                                                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-warning/10 text-warning border border-warning/20 font-black italic text-caption">
                                                                                                       <AlertTriangle className="w-3 h-3" />
                                                                                                       MANQUANT
                                                                                                    </span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-4 text-muted-foreground text-center font-black border-y border-border group-hover/row:border-border tabular-nums">{entry.level ?? "—"}</td>
                                                                                            <td className="px-4 py-4 border-y border-border group-hover/row:border-border">
                                                                                                {coords ? (
                                                                                                    <div className="flex items-start gap-3">
                                                                                                       <div className="flex flex-col">
                                                                                                           <div className="flex items-center gap-1.5">
                                                                                                               <span className="text-success font-black tabular-nums tracking-wider text-sm bg-success/5 px-2 py-0.5 rounded-md">[{coords.x}, {coords.y}]</span>
                                                                                                           </div>
                                                                                                           <span className="text-caption font-bold text-muted-foreground mt-1 flex items-center gap-1 max-w-[140px] truncate">
                                                                                                               <MapPin className="w-2.5 h-2.5" />
                                                                                                               {entry.npcSubArea ?? entry.zone}
                                                                                                           </span>
                                                                                                       </div>
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <span className="text-muted-foreground italic font-bold">Inconnu</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-4 border-y border-r border-border group-hover/row:border-border first:rounded-l-2xl last:rounded-r-2xl text-center">
                                                                                                <div className="flex items-center justify-center gap-2">
                                                                                                    <Button 
                                                                                                        variant="ghost" 
                                                                                                        size="icon" 
                                                                                                        className="h-10 w-10 rounded-xl hover:bg-surface text-muted-foreground hover:text-foreground transition-all  active:scale-90"
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
                                                                                                    <Button 
                                                                                                        variant="ghost" 
                                                                                                        size="icon" 
                                                                                                        className="h-10 w-10 rounded-xl hover:bg-surface text-info hover:text-info transition-all  active:scale-90"
                                                                                                        onClick={() => {
                                                                                                            setEditingEntry(entry);
                                                                                                            setIsEntryDialogOpen(true);
                                                                                                        }}
                                                                                                    >
                                                                                                        <Edit2 className="w-4 h-4" />
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

            <EntryEditDialog 
                open={isEntryDialogOpen} 
                onOpenChange={setIsEntryDialogOpen} 
                entry={editingEntry} 
                onSuccess={() => router.refresh()} 
            />
        </div>
    );
}

function EntryEditDialog({ open, onOpenChange, entry, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, entry: any, onSuccess: () => void }) {
    const [formData, setFormData] = useState<any>({
        chainId: "",
        name: "",
        zone: "",
        questType: "QUEST",
        stepOrder: 0,
        isOptional: false,
        isLast: false,
        dofusdbId: "",
        mapId: "",
        coords: { x: null, y: null },
        notes: "",
        externalRef: ""
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (entry) {
            setFormData({ 
                ...entry, 
                dofusdbId: entry.dofusdbId || "", 
                mapId: entry.mapId || "", 
                coords: entry.coords || { x: null, y: null }, 
                externalRef: entry.externalRef || "",
                dungeonsRequired: Array.isArray(entry.dungeonsRequired) ? entry.dungeonsRequired : []
            });
        }
    }, [entry, open]);

    async function handleSubmit(e: any) {
        e.preventDefault();
        setLoading(true);
        const res = await upsertQuestEntry(entry?.id || null, {
            ...formData,
            dofusdbId: formData.dofusdbId ? parseInt(formData.dofusdbId) : null,
            mapId: formData.mapId ? parseInt(formData.mapId) : null,
            stepOrder: parseInt(formData.stepOrder) || 0
        });
        if (res.success) {
            toast.success("Étape enregistrée");
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(res.error || "Erreur lors de la sauvegarde");
        }
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-background border-border text-foreground max-w-xl rounded-3xl overflow-hidden p-0 shadow-2xl">
                <div className="p-8 border-b border-border bg-surface/30">
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                        Éditer : {entry?.name || "Étape"}
                    </DialogTitle>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">ID Base DofusDB</label>
                        <Input 
                            type="number" 
                            value={formData.dofusdbId} 
                            onChange={e => setFormData({...formData, dofusdbId: e.target.value})} 
                            className="bg-black/45 border border-border h-12 rounded-xl text-sm font-semibold focus-visible:ring-ring/50" 
                            placeholder="Ex: 4294" 
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-caption font-black uppercase tracking-widest text-info italic">Lien Tutoriel (DofusPourLesNoobs)</label>
                        <Input 
                            value={formData.externalRef || ""} 
                            onChange={e => setFormData({...formData, externalRef: e.target.value})} 
                            className="bg-info/10 border border-info/20 h-12 rounded-xl text-xs font-medium focus-visible:ring-ring/50" 
                            placeholder="https://www.dofuspourlesnoobs.com/..." 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-caption font-black uppercase tracking-widest text-success block">Coord X</label>
                            <Input 
                                type="number" 
                                value={formData.coords?.x ?? ""} 
                                onChange={e => setFormData({
                                    ...formData, 
                                    coords: { 
                                        ...formData.coords, 
                                        x: e.target.value === "" ? null : parseInt(e.target.value) 
                                    }
                                })} 
                                className="bg-success/10 border border-success/20 text-success h-12 rounded-xl text-center font-black focus-visible:ring-success/50" 
                                placeholder="-" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-caption font-black uppercase tracking-widest text-success block">Coord Y</label>
                            <Input 
                                type="number" 
                                value={formData.coords?.y ?? ""} 
                                onChange={e => setFormData({
                                    ...formData, 
                                    coords: { 
                                        ...formData.coords, 
                                        y: e.target.value === "" ? null : parseInt(e.target.value) 
                                    }
                                })} 
                                className="bg-success/10 border border-success/20 text-success h-12 rounded-xl text-center font-black focus-visible:ring-success/50" 
                                placeholder="-" 
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-border">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-11 text-muted-foreground hover:text-foreground">Annuler</Button>
                        <Button type="submit" disabled={loading} className="bg-info hover:bg-info text-info-foreground font-black italic text-caption uppercase tracking-widest rounded-xl h-11 px-8 shadow-xl">
                            {loading ? "Enregistrement..." : "Sauvegarder"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
