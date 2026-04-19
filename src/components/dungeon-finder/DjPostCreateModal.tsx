"use client";

import { cn } from "@/lib/utils";


import { useState, useEffect, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Plus, Search, Swords, Map,
    Users, CheckCircle2, X, Trophy, ChevronsUpDown, Check
} from "lucide-react";
import { createDjPost } from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    isExpedition: boolean;
    achievements: {
        id: string;
        points: number;
        challenge: { id: string; name: string; iconUrl?: string | null };
    }[];
}

interface DjPostCreateModalProps {
    guildId: string;
    isOpen: boolean;
    initialDungeonId?: string;
    isDiscordConfigured?: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export function DjPostCreateModal({ guildId, isOpen, initialDungeonId, isDiscordConfigured, onClose, onCreated }: DjPostCreateModalProps) {
    // Top-Level Mode
    const [mode, setMode] = useState<"DONJON" | "QUETE">("DONJON");

    // Donjons
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [loadingDungeons, setLoadingDungeons] = useState(false);
    const [dungeonSearch, setDungeonSearch] = useState("");
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null);
    const [selectedAchievements, setSelectedAchievements] = useState<string[]>([]);

    // Quêtes
    const [questSearchQuery, setQuestSearchQuery] = useState("");
    const [questSearchResults, setQuestSearchResults] = useState<any[]>([]);
    const [isSearchingQuests, setIsSearchingQuests] = useState(false);
    const [selectedQuest, setSelectedQuest] = useState<{ id: number; name: string } | null>(null);
    const [questUrl, setQuestUrl] = useState("");

    // Optional quest linked to a DONJON post
    const [showLinkedQuest, setShowLinkedQuest] = useState(false);
    const [linkedQuestSearch, setLinkedQuestSearch] = useState("");
    const [linkedQuestResults, setLinkedQuestResults] = useState<any[]>([]);
    const [isSearchingLinkedQuest, setIsSearchingLinkedQuest] = useState(false);
    const [linkedQuest, setLinkedQuest] = useState<{ id: number; name: string } | null>(null);

    // Shared Config
    const [step, setStep] = useState(1); // 1 = Search (Donjon/Quete), 2 = Config
    const [maxMembers, setMaxMembers] = useState(4);
    const [message, setMessage] = useState("");
    const [targetDate, setTargetDate] = useState("");
    const [requiredClasses, setRequiredClasses] = useState<string[]>([]);
    const [isDiscordPublished, setIsDiscordPublished] = useState(false);
    const [mentionRoleId, setMentionRoleId] = useState<string | null>(null);
    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color: string }[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [roleOpen, setRoleOpen] = useState(false);

    const [isPending, startTransition] = useTransition();

    // Reset all state on open, and re-check isDiscordConfigured when it changes
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setMode("DONJON");
            setDungeonSearch("");
            setSelectedDungeon(null);
            setSelectedAchievements([]);
            setQuestSearchQuery("");
            setQuestSearchResults([]);
            setSelectedQuest(null);
            setQuestUrl("");
            setShowLinkedQuest(false);
            setLinkedQuestSearch("");
            setLinkedQuestResults([]);
            setLinkedQuest(null);
            setMaxMembers(4);
            setMessage("");
            setTargetDate("");
            setRequiredClasses([]);
            setIsDiscordPublished(isDiscordConfigured === true);
            setMentionRoleId(null);
        }
    }, [isOpen, isDiscordConfigured]);

    // Fetch Discord Roles
    useEffect(() => {
        if (isOpen && isDiscordPublished && discordRoles.length === 0) {
            setIsLoadingRoles(true);
            getDiscordRolesAction(guildId)
                .then(res => {
                    if (res.success && res.roles) {
                        // Filter out @everyone if possible or just keep all
                        setDiscordRoles(res.roles.filter(r => r.name !== "@everyone") as any);
                    }
                })
                .catch(console.error)
                .finally(() => setIsLoadingRoles(false));
        }
    }, [isOpen, isDiscordPublished, guildId, discordRoles.length]);

    // Handle initialDungeonId when dungeons are loaded
    useEffect(() => {
        if (isOpen && initialDungeonId && dungeons.length > 0) {
            const found = dungeons.find(d => d.id === initialDungeonId);
            if (found) {
                setMode("DONJON");
                setSelectedDungeon(found);
                setStep(2); // Jump directly to config
            }
        }
    }, [isOpen, initialDungeonId, dungeons]);

    // Fetch Dungeons on open
    useEffect(() => {
        if (isOpen && dungeons.length === 0) {
            setLoadingDungeons(true);
            getDungeonsWithAchievements()
                .then(res => { if (res.success && res.data) setDungeons(res.data); })
                .catch(console.error)
                .finally(() => setLoadingDungeons(false));
        }
    }, [isOpen, dungeons.length]);

    // DofusDB Quest search debounce
    useEffect(() => {
        if (mode !== "QUETE" || questSearchQuery.trim().length < 3) {
            setQuestSearchResults([]);
            return;
        }

        const controller = new AbortController();
        setIsSearchingQuests(true);

        const timer = setTimeout(() => {
            fetch(`https://api.dofusdb.fr/quests?name.fr[$regex]=${encodeURIComponent(questSearchQuery)}&$limit=8`, {
                signal: controller.signal
            })
                .then(res => {
                    if (!res.ok) throw new Error("API DofusDB indisponible");
                    return res.json();
                })
                .then(data => {
                    if (data.data) setQuestSearchResults(data.data);
                })
                .catch(err => {
                    if (err.name !== "AbortError") console.error("Erreur DofusDB:", err);
                })
                .finally(() => setIsSearchingQuests(false));
        }, 400);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [questSearchQuery, mode]);

    // Linked quest search (DONJON mode optional quest)
    useEffect(() => {
        if (!showLinkedQuest || linkedQuestSearch.trim().length < 3) {
            setLinkedQuestResults([]);
            return;
        }
        const controller = new AbortController();
        setIsSearchingLinkedQuest(true);
        const timer = setTimeout(() => {
            fetch(`https://api.dofusdb.fr/quests?name.fr[$regex]=${encodeURIComponent(linkedQuestSearch)}&$limit=6`, {
                signal: controller.signal
            })
                .then(res => res.json())
                .then(data => { if (data.data) setLinkedQuestResults(data.data); })
                .catch(err => { if (err.name !== "AbortError") console.error(err); })
                .finally(() => setIsSearchingLinkedQuest(false));
        }, 400);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [linkedQuestSearch, showLinkedQuest]);

    const filteredDungeons = useMemo(() => {
        if (!dungeonSearch.trim()) return dungeons;
        const q = dungeonSearch.toLowerCase();
        return dungeons.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.bossName.toLowerCase().includes(q)
        );
    }, [dungeons, dungeonSearch]);

    function handleClose() {
        if (!isPending) onClose();
    }

    function toggleAchievement(id: string) {
        setSelectedAchievements(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    }

    function toggleClass(className: string) {
        setRequiredClasses(prev =>
            prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className]
        );
    }

    async function handleSubmit() {
        if (mode === "DONJON" && !selectedDungeon) {
            toast.error("Veuillez sélectionner un donjon.");
            return;
        }
        if (mode === "QUETE" && !selectedQuest) {
            toast.error("Veuillez choisir ou saisir manuellement une quête.");
            return;
        }
        if (!targetDate) {
            toast.error("Veuillez définir une date et une heure prévues.");
            return;
        }

        startTransition(async () => {
            const res = await createDjPost(guildId, {
                mode,
                dungeonId: mode === "DONJON" ? selectedDungeon!.id : null,
                questId: mode === "QUETE" ? selectedQuest!.id : (linkedQuest ? linkedQuest.id : null),
                questName: mode === "QUETE" ? selectedQuest!.name : (linkedQuest ? linkedQuest.name : null),
                questUrl: mode === "QUETE" && questUrl ? questUrl : null,
                wantedAchievementIds: mode === "DONJON" ? selectedAchievements : [],
                maxMembers,
                message: message ? message : null,
                targetDate: targetDate ? new Date(targetDate) : null,
                requiredClasses,
                isDiscordPublished,
                mentionRoleId,
            });

            if (res.success) {
                toast.success("Votre recherche de groupe est en ligne !");
                handleClose();
                onCreated();
            } else {
                toast.error(res.error || "Erreur lors de la publication.");
            }
        });
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="w-[95vw] max-w-2xl bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl text-white max-h-[90vh] overflow-y-auto p-0 gap-0 custom-scrollbar">
                <div className="p-6 pb-4 border-b border-white/5 bg-zinc-900/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -mr-16 -mt-16" />
                    <DialogTitle className="text-xl font-black flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-900/10">
                            <Plus className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl tracking-tight text-white leading-none">
                                {mode === "DONJON" ? "Nouveau Groupe Donjon" : "Nouveau Groupe Quête"}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                                Planifier une session de guilde
                            </span>
                        </div>
                    </DialogTitle>
                </div>

                {/* Content Area */}
                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div key="step1" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
                                {/* Mode Selector - Refined */}
                                <div className="grid grid-cols-2 bg-zinc-900/80 border border-white/5 p-1 rounded-2xl w-full shadow-inner relative overflow-hidden">
                                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-zinc-800 border border-white/10 rounded-xl transition-all duration-500 ease-out z-0 ${mode === "QUETE" ? "translate-x-full" : "translate-x-0"}`} />
                                    <button
                                        onClick={() => setMode("DONJON")}
                                        className={`relative z-10 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${mode === "DONJON" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                                    >
                                        <Swords className={`w-4 h-4 transition-colors ${mode === "DONJON" ? "text-amber-500" : ""}`} />
                                        Mode Donjons
                                    </button>
                                    <button
                                        onClick={() => setMode("QUETE")}
                                        className={`relative z-10 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${mode === "QUETE" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                                    >
                                        <Map className={`w-4 h-4 transition-colors ${mode === "QUETE" ? "text-emerald-500" : ""}`} />
                                        Mode Quêtes
                                    </button>
                                </div>

                                {/* Donjon Search */}
                                {mode === "DONJON" && (
                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={dungeonSearch}
                                                onChange={(e) => setDungeonSearch(e.target.value)}
                                                placeholder="Rechercher un donjon ou un boss..."
                                                className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-11 pr-4 py-4 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all placeholder:text-zinc-600 shadow-xl"
                                            />
                                        </div>

                                        {loadingDungeons ? (
                                            <div className="py-16 text-center text-zinc-500 animate-pulse bg-zinc-900/30 rounded-3xl border border-white/5">
                                                Consultation du bestiaire...
                                            </div>
                                        ) : (
                                            <div className="h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar p-1">
                                                {filteredDungeons.length === 0 ? (
                                                    <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-white/5 border-dashed">
                                                        <Search className="w-8 h-8 mx-auto mb-3 text-zinc-700 opacity-50" />
                                                        <p className="text-zinc-500 text-sm">Aucun donjon trouvé pour "{dungeonSearch}"</p>
                                                    </div>
                                                ) : filteredDungeons.map((d) => (
                                                    <button
                                                        key={d.id}
                                                        onClick={() => { setSelectedDungeon(d); setStep(2); }}
                                                        className="w-full flex items-center gap-4 p-3 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-amber-500/30 hover:bg-zinc-800 transition-all group text-left relative overflow-hidden"
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-950 border border-white/10 shrink-0 relative z-10">
                                                            {d.imageUrl
                                                                ? <img src={d.imageUrl} alt={d.bossName} className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform duration-500" />
                                                                : <div className="w-full h-full flex items-center justify-center text-zinc-600"><Swords className="w-6 h-6" /></div>}
                                                        </div>
                                                        <div className="flex-1 min-w-0 relative z-10">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-black text-zinc-200 group-hover:text-white transition-colors truncate">{d.name}</p>
                                                                <span className="text-[9px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">Lvl {d.level}</span>
                                                            </div>
                                                            <p className="text-xs text-zinc-500 mt-0.5 truncate group-hover:text-zinc-400">{d.bossName}</p>
                                                        </div>
                                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 translate-x-4 relative z-10 border border-white/10">
                                                            <Plus className="w-4 h-4 text-white" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Quête Search */}
                                {mode === "QUETE" && (
                                    <div className="space-y-4">
                                        <div className="space-y-4 p-4 bg-slate-900 rounded-xl border border-slate-800">
                                            <div className="relative z-50">
                                                <p className="text-sm font-bold text-slate-300 mb-2">Rechercher une quête</p>

                                                {selectedQuest ? (
                                                    <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                                                            <span className="text-sm font-bold text-indigo-100 truncate">{selectedQuest.name}</span>
                                                            {selectedQuest.id === -1 && <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono border border-slate-700 shrink-0">Saisie Libre</span>}
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedQuest(null)} className="text-slate-400 hover:text-white shrink-0 ml-2">Modifier</Button>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={questSearchQuery}
                                                            onChange={(e) => setQuestSearchQuery(e.target.value)}
                                                            placeholder="Ex: L'Étoile du Gerbé..."
                                                            className="w-full bg-slate-900 border border-white/5 rounded-lg pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                                                        />

                                                        {questSearchQuery.trim().length > 0 && (
                                                            <div className="mt-3 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden custom-scrollbar max-h-64 overflow-y-auto relative shadow-inner">
                                                                <button
                                                                    onClick={() => setSelectedQuest({ id: -1, name: questSearchQuery.trim() })}
                                                                    className="w-full text-left px-4 py-3 text-sm font-bold text-indigo-400 bg-indigo-950/20 hover:bg-indigo-900/40 transition-colors border-b border-slate-700/50 flex items-center gap-2"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                    Saisir manuellement "{questSearchQuery}"
                                                                </button>

                                                                {questSearchQuery.length >= 3 && (
                                                                    <>
                                                                        {isSearchingQuests && <div className="p-4 text-sm text-slate-400 flex items-center gap-2"><div className="w-4 h-4 border-2 border-slate-500 border-t-indigo-500 rounded-full animate-spin" /> Recherche Base de Données...</div>}

                                                                        {!isSearchingQuests && questSearchResults.length === 0 && (
                                                                            <div className="p-4 text-sm text-slate-500">Aucune quête officielle trouvée sur DofusDB.</div>
                                                                        )}

                                                                        {!isSearchingQuests && questSearchResults.map(q => (
                                                                            <button
                                                                                key={q.id}
                                                                                onClick={() => setSelectedQuest({ id: q.id, name: q.name?.fr || "" })}
                                                                                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-b border-slate-700/50 last:border-0 flex gap-3 truncate"
                                                                            >
                                                                                <span className="text-slate-500 font-mono text-[10px] w-10 shrink-0 pt-0.5">#{q.id}</span>
                                                                                <span className="truncate block font-medium">{q.name?.fr}</span>
                                                                            </button>
                                                                        ))}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full h-12 text-sm bg-indigo-600 hover:bg-indigo-500 font-bold disabled:opacity-50"
                                            disabled={!selectedQuest}
                                            onClick={() => setStep(2)}
                                        >
                                            Suivant
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                {/* Header Recap - Refined */}
                                <div className="flex items-center gap-4 bg-zinc-900/60 rounded-3xl p-5 border border-white/10 shadow-xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-50" />
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border relative z-10 ${mode === "DONJON" ? "bg-zinc-950 border-white/10" : "bg-emerald-950/30 border-emerald-500/20"}`}>
                                        {mode === "DONJON" && selectedDungeon?.imageUrl ? (
                                            <img src={selectedDungeon.imageUrl} alt="" className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500" />
                                        ) : mode === "DONJON" ? (
                                            <Swords className="w-6 h-6 text-zinc-500" />
                                        ) : (
                                            <Map className="w-6 h-6 text-emerald-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 relative z-10">
                                        <p className="font-black text-white text-lg tracking-tight truncate leading-tight">
                                            {mode === "DONJON" ? selectedDungeon?.name : selectedQuest?.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {mode === "DONJON" ? (
                                                <>
                                                    <span className="text-[10px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">NIVEAU {selectedDungeon?.level}</span>
                                                    <span className="text-[11px] font-medium text-zinc-500 truncate">{selectedDungeon?.bossName}</span>
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">GROUPE QUÊTE</span>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="h-9 px-4 rounded-xl text-xs font-black text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 shrink-0 relative z-10">
                                        RETOUR
                                    </Button>
                                </div>

                                {/* Dynamic Fields depending on Mode */}
                                {mode === "DONJON" && selectedDungeon?.achievements.length ? (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Succès visés (optionnel)</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedDungeon.achievements.map((a) => {
                                                const selected = selectedAchievements.includes(a.id);
                                                return (
                                                    <button
                                                        key={a.id}
                                                        onClick={() => toggleAchievement(a.id)}
                                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${selected
                                                            ? "border-amber-500/40 bg-amber-500/10 text-amber-100 shadow-lg shadow-amber-900/5"
                                                            : "border-white/5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                                                            }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${selected ? "bg-amber-500/20 border-amber-500/20" : "bg-zinc-950 border-white/5"}`}>
                                                            {a.challenge.iconUrl ? <img src={a.challenge.iconUrl} alt="" className="w-5 h-5 object-contain" /> : <Trophy className="w-4 h-4" />}
                                                        </div>
                                                        <span className="flex-1 text-left truncate">{a.challenge.name}</span>
                                                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : mode === "QUETE" && (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Lien vers un Tutoriel (Optionnel)</p>
                                        <div className="relative group">
                                            <Map className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                                            <input
                                                type="url"
                                                value={questUrl}
                                                onChange={(e) => setQuestUrl(e.target.value)}
                                                placeholder="Ex: https://www.dofuspourlesnoobs.com/..."
                                                className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-11 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-700 shadow-xl"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Optional linked quest for DONJON mode */}
                                {mode === "DONJON" && (
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => { setShowLinkedQuest(v => !v); setLinkedQuest(null); setLinkedQuestSearch(""); }}
                                            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-cyan-400 transition-colors"
                                        >
                                            <Map className="w-3.5 h-3.5" />
                                            {showLinkedQuest ? "▼ Masquer la quête liée" : "▶ Associer une quête (optionnel)"}
                                        </button>
                                        {showLinkedQuest && (
                                            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 space-y-2">
                                                {linkedQuest ? (
                                                    <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
                                                        <span className="text-sm text-cyan-300 font-medium flex items-center gap-2">
                                                            <Map className="w-3.5 h-3.5" />
                                                            {linkedQuest.name}
                                                        </span>
                                                        <button onClick={() => setLinkedQuest(null)} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={linkedQuestSearch}
                                                            onChange={e => setLinkedQuestSearch(e.target.value)}
                                                            placeholder="Rechercher une quête sur DofusDB..."
                                                            className="w-full bg-slate-900 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                                                        />
                                                        {isSearchingLinkedQuest && <p className="text-xs text-slate-500 animate-pulse">Recherche...</p>}
                                                        {linkedQuestResults.length > 0 && (
                                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                {linkedQuestResults.map(q => (
                                                                    <button key={q.id} type="button"
                                                                        onClick={() => { setLinkedQuest({ id: q.id, name: q.name?.fr || "" }); setLinkedQuestResults([]); setLinkedQuestSearch(""); }}
                                                                        className="w-full text-left px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
                                                                    >
                                                                        {q.name?.fr}
                                                                        {q.levelMin && <span className="text-xs text-slate-500 ml-2">Niv. {q.levelMin}</span>}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Date & Membres */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Date & Heure prévue</p>
                                        <DateTimePicker
                                            value={targetDate}
                                            onChange={setTargetDate}
                                            minDate={new Date()}
                                            placeholder="Choisir date & heure"
                                            timeOptional={true}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Taille du groupe</p>
                                        <div className="flex bg-zinc-900 border border-white/5 rounded-2xl p-1 shadow-inner h-[52px] items-center">
                                            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                                <button
                                                    key={n}
                                                    onClick={() => setMaxMembers(n)}
                                                    className={`flex-1 flex justify-center items-center h-full text-xs font-black transition-all rounded-xl ${maxMembers === n ? "bg-zinc-800 text-white border border-white/10 shadow-lg" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"}`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Classes Requises */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between ml-1">
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Besoin spécifique (Options)</p>
                                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter bg-zinc-900 px-2 py-0.5 rounded border border-white/5">{requiredClasses.length} SÉLECTIONNÉES</span>
                                    </div>
                                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 p-4 rounded-3xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm">
                                        {DOFUS_CLASSES.map((c) => {
                                            const isSelected = requiredClasses.includes(c.name);
                                            return (
                                                <button
                                                    key={c.id}
                                                    title={c.name}
                                                    onClick={() => toggleClass(c.name)}
                                                    className={`aspect-square rounded-xl flex items-center justify-center transition-all border group/class ${isSelected 
                                                        ? "border-amber-500/50 bg-amber-500/10 shadow-[0_0_15px_-5px_var(--color-amber-500)] scale-105" 
                                                        : "border-transparent opacity-30 hover:opacity-100 hover:bg-zinc-800 hover:border-white/10"}`}
                                                >
                                                    <img src={c.icon} alt={c.name} className="w-7 h-7 object-contain drop-shadow-lg group-hover/class:scale-110 transition-transform" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Message */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Note pour la guilde</p>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={3}
                                        placeholder="Ex: On cherche un tank pour clean les succès du premier coup..."
                                        className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all resize-none shadow-xl placeholder:text-zinc-700"
                                    />
                                </div>

                                {/* Footer Action - Refined */}
                                <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-white/5 mt-4 relative">
                                    <div className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-2xl border border-white/5 shadow-inner">
                                        <Switch
                                            checked={isDiscordPublished}
                                            onCheckedChange={setIsDiscordPublished}
                                            disabled={!isDiscordConfigured}
                                            className="data-[state=checked]:bg-indigo-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className={`text-xs font-black uppercase tracking-widest ${isDiscordConfigured ? 'text-zinc-300' : 'text-zinc-600'}`}>Synchro Discord</span>
                                            {!isDiscordConfigured && (
                                                <span className="text-[8px] text-amber-500/70 font-black uppercase tracking-tighter">⚠️ Non configuré</span>
                                            )}
                                        </div>
                                    </div>

                                    {isDiscordPublished && discordRoles.length > 0 && (
                                        <div className="flex flex-col gap-2 min-w-[180px]">
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Mentionner un rôle</span>
                                            <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={roleOpen}
                                                        className="h-10 bg-zinc-900 border-white/10 text-xs font-bold rounded-xl justify-between group/role w-full"
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            {mentionRoleId ? (
                                                                <>
                                                                    <div 
                                                                        className="w-2 h-2 rounded-full shrink-0" 
                                                                        style={{ backgroundColor: discordRoles.find(r => r.id === mentionRoleId)?.color === "#000000" ? "#9ca3af" : discordRoles.find(r => r.id === mentionRoleId)?.color }} 
                                                                    />
                                                                    <span className="truncate">{discordRoles.find(r => r.id === mentionRoleId)?.name}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-zinc-500 italic">Aucun ping</span>
                                                            )}
                                                        </div>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-zinc-950 border-white/10" align="end">
                                                    <Command className="bg-transparent text-white">
                                                        <CommandInput placeholder="Rechercher..." className="h-9 border-none focus:ring-0" />
                                                        <CommandList className="max-h-[280px] custom-scrollbar">
                                                            <CommandEmpty>Aucun rôle.</CommandEmpty>
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    onSelect={() => {
                                                                        setMentionRoleId(null);
                                                                        setRoleOpen(false);
                                                                    }}
                                                                    className="text-zinc-500 italic focus:bg-white/10 cursor-pointer text-xs"
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-3 h-3",
                                                                            !mentionRoleId ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    Aucun ping
                                                                </CommandItem>
                                                                {discordRoles.map((role) => (
                                                                    <CommandItem
                                                                        key={role.id}
                                                                        onSelect={() => {
                                                                            setMentionRoleId(role.id);
                                                                            setRoleOpen(false);
                                                                        }}
                                                                        className="text-white focus:bg-white/10 cursor-pointer text-xs"
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-3 w-3",
                                                                                mentionRoleId === role.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex items-center gap-2 flex-1 truncate font-bold">
                                                                            <div 
                                                                                className="w-2 h-2 rounded-full shrink-0" 
                                                                                style={{ backgroundColor: role.color === "#000000" ? "#9ca3af" : role.color }} 
                                                                            />
                                                                            <span className="truncate">{role.name}</span>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}

                                    <Button
                                        className={`h-14 px-10 rounded-2xl font-black text-sm tracking-tight transition-all active:scale-95 shadow-2xl relative group overflow-hidden ${
                                            mode === "DONJON" 
                                                ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-900/20" 
                                                : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-900/20"
                                        }`}
                                        onClick={handleSubmit}
                                        disabled={isPending || (mode === "DONJON" && !selectedDungeon) || (mode === "QUETE" && !selectedQuest)}
                                    >
                                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                                        <div className="flex items-center gap-3 relative z-10">
                                            {isPending ? (
                                                <div className="w-5 h-5 border-3 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                                            ) : (
                                                <Users className="w-5 h-5" />
                                            )}
                                            {isPending ? "PUBLICATION..." : "LANCER LA SESSION"}
                                        </div>
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
}
