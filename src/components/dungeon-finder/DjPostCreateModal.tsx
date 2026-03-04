"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Plus, Search, Swords, Map,
    Users, CheckCircle2, X
} from "lucide-react";
import { createDjPost } from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { Switch } from "@/components/ui/switch";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
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
        }
    }, [isOpen, isDiscordConfigured]);

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
                <div className="p-6 pb-4 border-b border-white/5 bg-slate-900/30">
                    <DialogTitle className="text-xl font-black flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-inner">
                            <Plus className="w-4 h-4 text-indigo-400" />
                        </div>
                        {mode === "DONJON" ? "Nouveau Groupe de Donjon" : "Nouveau Groupe de Quête"}
                    </DialogTitle>
                </div>

                {/* Content Area */}
                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div key="step1" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
                                {/* Type Selector */}
                                <div className="flex bg-slate-900/80 border border-white/5 p-1 rounded-2xl w-full shadow-inner">
                                    <button
                                        onClick={() => setMode("DONJON")}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${mode === "DONJON" ? "bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                                    >
                                        <Swords className="w-4 h-4" />
                                        Mode Donjons
                                    </button>
                                    <button
                                        onClick={() => setMode("QUETE")}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${mode === "QUETE" ? "bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                                    >
                                        <Map className="w-4 h-4" />
                                        Mode Quêtes
                                    </button>
                                </div>

                                {/* Donjon Search */}
                                {mode === "DONJON" && (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={dungeonSearch}
                                                onChange={(e) => setDungeonSearch(e.target.value)}
                                                placeholder="Rechercher un donjon par nom ou boss..."
                                                className="w-full bg-slate-900 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                                            />
                                        </div>

                                        {loadingDungeons ? (
                                            <div className="py-12 text-center text-slate-500 animate-pulse">Consultation du bestiaire...</div>
                                        ) : (
                                            <div className="h-64 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar border border-slate-800/50 rounded-xl p-1 bg-slate-900/20">
                                                {filteredDungeons.length === 0 ? (
                                                    <p className="text-center text-slate-600 py-12">Aucun donjon trouvé pour "{dungeonSearch}"</p>
                                                ) : filteredDungeons.map((d) => (
                                                    <button
                                                        key={d.id}
                                                        onClick={() => { setSelectedDungeon(d); setStep(2); }}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/80 bg-slate-900/50 focus:bg-slate-800 border border-transparent hover:border-indigo-500/30 focus:border-indigo-500/40 transition-all group text-left"
                                                    >
                                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800/50 border border-white/5 shrink-0">
                                                            {d.imageUrl
                                                                ? <img src={d.imageUrl} alt={d.bossName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                                : <Swords className="w-5 h-5 m-2.5 text-slate-500" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors truncate">{d.name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[11px] text-slate-500 truncate">{d.bossName}</span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                                <span className="text-[11px] font-mono text-slate-400">Niv. {d.level}</span>
                                                            </div>
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
                                {/* Header Recap */}
                                <div className="flex items-center gap-4 bg-slate-900/40 rounded-2xl p-4 border border-white/5 shadow-inner">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${mode === "DONJON" ? "bg-slate-800/80 border-white/10" : "bg-cyan-950/80 border-cyan-500/30"}`}>
                                        {mode === "DONJON" && selectedDungeon?.imageUrl ? (
                                            <img src={selectedDungeon.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                                        ) : mode === "DONJON" ? (
                                            <Swords className="w-6 h-6 text-slate-400" />
                                        ) : (
                                            <Map className="w-6 h-6 text-cyan-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-white text-base truncate">
                                            {mode === "DONJON" ? selectedDungeon?.name : selectedQuest?.name}
                                        </p>
                                        <p className="text-xs font-medium text-slate-400 mt-0.5">
                                            {mode === "DONJON" ? `Niv. ${selectedDungeon?.level} — ${selectedDungeon?.bossName}` : "Mode Quête"}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 shrink-0">
                                        Changer
                                    </Button>
                                </div>

                                {/* Dynamic Fields depending on Mode */}
                                {mode === "DONJON" && selectedDungeon?.achievements.length ? (
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-slate-300">Succès visés (optionnel)</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedDungeon.achievements.map((a) => {
                                                const selected = selectedAchievements.includes(a.id);
                                                return (
                                                    <button
                                                        key={a.id}
                                                        onClick={() => toggleAchievement(a.id)}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${selected
                                                            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                                            : "border-white/5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-slate-300"
                                                            }`}
                                                    >
                                                        {a.challenge.iconUrl && <img src={a.challenge.iconUrl} alt="" className="w-5 h-5 object-contain" />}
                                                        {a.challenge.name}
                                                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 ml-1" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : mode === "QUETE" && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-slate-300">Lien vers un Tutoriel (Optionnel)</p>
                                        <input
                                            type="url"
                                            value={questUrl}
                                            onChange={(e) => setQuestUrl(e.target.value)}
                                            placeholder="Ex: https://www.dofuspourlesnoobs.com/..."
                                            className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                                        />
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

                                <div className="grid grid-cols-2 gap-6">
                                    {/* Date */}
                                    <div className="space-y-2 flex flex-col justify-end">
                                        <p className="text-sm font-bold text-slate-300">
                                            Date prévue <span className="text-rose-500">*</span>
                                            <span className="text-slate-500 font-normal text-xs ml-1">(heure optionnelle)</span>
                                        </p>
                                        <DateTimePicker
                                            value={targetDate}
                                            onChange={setTargetDate}
                                            minDate={new Date()}
                                            placeholder="Choisir date & heure"
                                            timeOptional={true}
                                        />
                                    </div>
                                    {/* Membres */}
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-slate-300">Places dispo</p>
                                        <div className="flex bg-slate-900/80 border border-white/5 rounded-xl p-1 shadow-inner h-11 items-center">
                                            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                                <button
                                                    key={n}
                                                    onClick={() => setMaxMembers(n)}
                                                    className={`flex-1 flex justify-center items-center h-full text-[13px] font-bold transition-all rounded-lg ${maxMembers === n ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Classes Requises (Optionnel) */}
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-slate-300 flex justify-between">
                                        Classes demandées (Optionnel)
                                        <span className="text-xs text-slate-500 font-normal">{requiredClasses.length} sélec.</span>
                                    </p>
                                    <div className="grid grid-cols-9 sm:grid-cols-10 gap-1.5 p-3 rounded-xl bg-slate-900 border border-slate-800">
                                        {DOFUS_CLASSES.map((c) => {
                                            const isSelected = requiredClasses.includes(c.name);
                                            return (
                                                <button
                                                    key={c.id}
                                                    title={c.name}
                                                    onClick={() => toggleClass(c.name)}
                                                    className={`aspect-square rounded-lg flex items-center justify-center transition-all border ${isSelected ? "border-indigo-500/40 bg-indigo-500/20 shadow-inner" : "border-transparent opacity-40 hover:opacity-100 hover:bg-white/5"}`}
                                                >
                                                    <img src={c.icon} alt={c.name} className="w-6 h-6 object-contain drop-shadow-md" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Message */}
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-slate-300">Contexte / Message (Optionnel)</p>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={2}
                                        placeholder="Je cherche des gens stuff pour clean vite, vocal exigé..."
                                        className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none shadow-inner"
                                    />
                                </div>

                                {/* Footer Action */}
                                <div className="pt-4 flex items-center justify-between border-t border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <Switch
                                            checked={isDiscordPublished}
                                            onCheckedChange={setIsDiscordPublished}
                                            disabled={!isDiscordConfigured}
                                            className="data-[state=checked]:bg-indigo-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-medium ${isDiscordConfigured ? 'text-slate-300' : 'text-slate-500'}`}>Publier sur Discord</span>
                                            {!isDiscordConfigured && (
                                                <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-tight italic">
                                                    ⚠️ Salon Discord non configuré par l'admin. Publication impossible.
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        className={`h-11 px-6 font-black ${mode === "DONJON" ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20" : "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20"} text-white disabled:opacity-40 shadow-md`}
                                        onClick={handleSubmit}
                                        disabled={isPending || (mode === "DONJON" && !selectedDungeon) || (mode === "QUETE" && !selectedQuest)}
                                    >
                                        <Users className="w-4 h-4 mr-2" />
                                        {isPending ? "Création..." : "Lancer le groupe"}
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
