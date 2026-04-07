"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { compileDofusChain, updateDofusCategory } from "@/server/actions/dofus-quest-admin-actions";
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
                            className="w-full flex items-center gap-6 px-8 py-7 hover:bg-white/[0.03] transition-all text-left group cursor-pointer"
                        >
                            {/* Dofus icon */}
                            {dofus.imageUrl ? (
                                <div className="relative">
                                    <div className="absolute inset-0 blur-2xl opacity-20 bg-white rounded-full group-hover:opacity-40 transition-opacity" />
                                    <img
                                        src={dofus.imageUrl}
                                        alt={dofus.name}
                                        className="relative w-16 h-16 rounded-2xl object-contain bg-black/40 p-1.5 border border-white/10"
                                    />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5">
                                    <Trophy className="w-8 h-8 text-zinc-700" />
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-2xl font-black text-white italic tracking-tight">{dofus.name}</h3>
                                    <span className="text-[10px] bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-white/5">{dofus.slug}</span>
                                    {dofus.questCount > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                disabled={isPending}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    startTransition(async () => {
                                                        const toastId = toast.loading(`Synchronisation complète de la base de données...`);
                                                        const { seedDofusData } = await import("@/server/actions/dofus-quest-actions");
                                                        const res = await seedDofusData("GOD");
                                                        if (res.success) toast.success("Base de données synchronisée !", { id: toastId });
                                                        else toast.error("Erreur de synchronisation", { id: toastId });
                                                    });
                                                }}
                                                className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                                            >
                                                <Database className={`w-3.5 h-3.5 mr-1.5 ${isPending ? 'animate-bounce' : ''}`} />
                                                SYNCHRONISER TOUTE LA BASE
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-xs text-zinc-500 font-bold">
                                    <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-400" /> {dofus.chainCount} succès</span>
                                    <span className="flex items-center gap-2"><Database className="w-4 h-4 text-sky-400" /> {dofus.questCount} quêtes</span>
                                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-400" /> {dofus.withCoords} coords</span>
                                    <span className="flex items-center gap-2"><Package className="w-4 h-4 text-amber-400" /> {dofus.withItems} items</span>
                                    {dofus.dungeons > 0 && (
                                        <span className="text-rose-400 flex items-center gap-2">🏰 {dofus.dungeons} donjons</span>
                                    )}
                                </div>
                            </div>

                            {/* Coverage meter */}
                            <div className="flex items-center gap-5">
                                <div className="text-right">
                                    <div className={`text-2xl font-black tabular-nums ${coveragePct === 100 ? "text-emerald-400" : coveragePct > 75 ? "text-sky-400" : "text-amber-500"}`}>
                                        {coveragePct}%
                                    </div>
                                    <div className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Enrichissement</div>
                                </div>
                                <div className={`p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors ${isExpanded ? "rotate-180" : ""}`}>
                                    <ChevronDown className="w-6 h-6 text-zinc-500" />
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
                                    <div className="px-8 pb-8 space-y-4 border-t border-white/5 pt-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                {/* Level range */}
                                                {dofus.minLevel != null ? (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-400">
                                                        <span className="font-black uppercase tracking-widest text-[9px]">Lvl recommandé</span>
                                                        <span className="text-white font-black italic">{dofus.minLevel} – {dofus.maxLevel}</span>
                                                    </div>
                                                ) : <div />}

                                                {/* Edit Categories */}
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={dofus.filterCategory}
                                                        onValueChange={(val) => handleCategoryChange(dofus.id, val, dofus.filterSubCategory)}
                                                    >
                                                        <SelectTrigger className="h-8 min-w-[140px] text-xs font-black bg-white/5 border-white/10">
                                                            <SelectValue placeholder="Catégorie" />
                                                        </SelectTrigger>
                                                        <SelectContent>
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
                                                            <SelectTrigger className="h-8 min-w-[100px] text-xs font-black bg-white/5 border-white/10">
                                                                <SelectValue placeholder="Sous-catégorie" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="4/6">4/6</SelectItem>
                                                                <SelectItem value="6/6">6/6</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <Button 
                                                disabled={isPending}
                                                onClick={(e) => { e.stopPropagation(); handleCompile(dofus.slug); }}
                                                className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white h-8 text-[10px] font-black uppercase tracking-widest"
                                            >
                                                <Terminal className="w-3.5 h-3.5 mr-2" /> Compiler ce Dofus
                                            </Button>
                                        </div>

                                        {/* Chain list */}
                                        {dofus.chains.map(chain => {
                                            const chainExpanded = expandedChain === chain.id;
                                            const entriesWithCoords = chain.entries.filter(e => e.coords != null).length;
                                            const missingItems = chain.entries.filter(e => !e.itemsRequired || e.itemsRequired.length === 0);

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
                                                            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">{chain.entries.length} étapes</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-[11px] text-zinc-500 font-bold tabular-nums">
                                                                {entriesWithCoords}/{chain.entries.length} localisations
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
                                                                        <table className="w-full text-[12px] border-collapse">
                                                                            <thead>
                                                                                <tr className="bg-white/5 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                                                                                    <th className="text-left px-5 py-3 border-r border-white/5">#</th>
                                                                                    <th className="text-left px-4 py-3 border-r border-white/5">Quête</th>
                                                                                    <th className="text-left px-4 py-3 border-r border-white/5">DB ID</th>
                                                                                    <th className="text-left px-4 py-3 border-r border-white/5 text-center">Lvl</th>
                                                                                    <th className="text-left px-4 py-3 border-r border-white/5">Position</th>
                                                                                    <th className="text-left px-4 py-3 border-r border-white/5">Walkthrough</th>
                                                                                    <th className="text-left px-4 py-3 border-r border-white/5 text-center">Ressources</th>
                                                                                    <th className="text-center px-4 py-3">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-white/5">
                                                                                {chain.entries.map((entry, idx) => {
                                                                                    const coords = entry.coords as any;
                                                                                    const items = (entry.itemsRequired ?? []) as any[];
                                                                                    const objectives = (entry.objectives ?? []) as string[];
                                                                                    const hasIssue = !entry.dofusdbId || !coords;

                                                                                    return (
                                                                                        <tr key={entry.id} className={`group/row transition-colors ${hasIssue ? "bg-amber-500/[0.02]" : "hover:bg-white/[0.015]"}`}>
                                                                                            <td className="px-5 py-3 text-zinc-600 font-black tabular-nums border-r border-white/5">{idx + 1}</td>
                                                                                            <td className="px-4 py-3 border-r border-white/5">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="font-black text-white italic truncate max-w-[220px]">{entry.name}</span>
                                                                                                    {entry.isDungeon && <span title="Donjon requis" className="text-xs">🏰</span>}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-4 py-3 tabular-nums border-r border-white/5">
                                                                                                {entry.dofusdbId ? (
                                                                                                    <a
                                                                                                        href={`https://dofusdb.fr/fr/database/quest/${entry.dofusdbId}`}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1.5"
                                                                                                    >
                                                                                                        {entry.dofusdbId}
                                                                                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                                                                                                    </a>
                                                                                                ) : (
                                                                                                    <span className="text-amber-500 font-black italic">MANQUANT</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-zinc-400 text-center font-bold border-r border-white/5">{entry.level ?? "—"}</td>
                                                                                            <td className="px-4 py-3 border-r border-white/5">
                                                                                                {coords ? (
                                                                                                    <div className="flex flex-col gap-0.5">
                                                                                                        <span className="text-emerald-400 font-black tabular-nums">[{coords.x}, {coords.y}]</span>
                                                                                                        <span className="text-[10px] text-zinc-600 truncate max-w-[120px]">{entry.npcSubArea ?? entry.zone}</span>
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <span className="text-zinc-700 italic">Non localisé</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 border-r border-white/5">
                                                                                                {objectives.length > 0 ? (
                                                                                                    <Popover>
                                                                                                        <PopoverTrigger asChild>
                                                                                                            <button className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors font-bold group/btn">
                                                                                                                <ListChecks className="w-3.5 h-3.5" />
                                                                                                                <span>{objectives.length} étapes</span>
                                                                                                            </button>
                                                                                                        </PopoverTrigger>
                                                                                                        <PopoverContent className="w-80 bg-zinc-950 border-white/10 p-4 shadow-2xl backdrop-blur-xl">
                                                                                                            <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-3 flex items-center gap-2">
                                                                                                                <ListChecks className="w-3 h-3" />
                                                                                                                Marche à suivre — {entry.name}
                                                                                                            </div>
                                                                                                            <div className="space-y-2">
                                                                                                                {objectives.map((obj, i) => (
                                                                                                                    <div key={i} className="flex gap-2 text-[11px] leading-tight text-zinc-400">
                                                                                                                        <span className="text-indigo-500 font-black">{i+1}.</span>
                                                                                                                        <span>{obj.replace(/\{npc,\d+\}/g, "NPC").replace(/\{item,\d+\}/g, "Objet")}</span>
                                                                                                                    </div>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        </PopoverContent>
                                                                                                    </Popover>
                                                                                                ) : (
                                                                                                    <span className="text-zinc-700 italic">Pas de texte</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 border-r border-white/5 text-center">
                                                                                                {items.length > 0 ? (
                                                                                                    <div className="flex -space-x-2 justify-center hover:space-x-1 transition-all">
                                                                                                        {items.slice(0, 3).map((item, i) => (
                                                                                                            <div 
                                                                                                                key={i} 
                                                                                                                className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 overflow-hidden flex items-center justify-center bg-black/40 p-1"
                                                                                                                title={`${item.amount}x ${item.name}`}
                                                                                                            >
                                                                                                                {item.img ? <img src={item.img} className="w-full h-full object-contain" /> : <Package className="w-3 h-3 text-zinc-600" />}
                                                                                                            </div>
                                                                                                        ))}
                                                                                                        {items.length > 3 && (
                                                                                                            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-[9px] font-black text-zinc-400">
                                                                                                                +{items.length - 3}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <span className="text-zinc-800">—</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-center">
                                                                                                <div className="flex items-center justify-center gap-2">
                                                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-white transition-all">
                                                                                                        <BookOpen className="w-3.5 h-3.5" />
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
