"use client";

import { cn } from "@/lib/utils";


import { useState, useEffect, useTransition, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Plus, Search, Swords, Map,
    Users, CheckCircle2, X, Trophy, ChevronsUpDown, Check, ChevronRight, ScrollText, Hash, AlertTriangle, Layers
} from "lucide-react";
import { createDjPost, createDjPosts } from "@/server/actions/dungeon-finder-actions";
import { DjMultiDungeonModal, type MultiDungeonSelection } from "./DjMultiDungeonModal";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { PingEstimate } from "@/components/shared/ping-estimate";
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
import { getDiscordChannelInfo } from "@/server/actions/discord-actions";
import { getDungeonFinderConfig } from "@/server/actions/dungeon-finder-actions";
import { Eye } from "lucide-react";

interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    isExpedition: boolean;
    isOcreQuest?: boolean;
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
    initialQuestName?: string;
    isDiscordConfigured?: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export function DjPostCreateModal({ guildId, isOpen, initialDungeonId, initialQuestName, isDiscordConfigured, onClose, onCreated }: DjPostCreateModalProps) {
    // Top-Level Mode
    const [step, setStep] = useState(1);
    const [mode, setMode] = useState<"DONJON" | "QUETE">("DONJON");

    // Donjons
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [loadingDungeons, setLoadingDungeons] = useState(false);
    const [dungeonSearch, setDungeonSearch] = useState("");
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null);
    const [selectedAchievements, setSelectedAchievements] = useState<string[]>([]);

    // Mode multi-donjons (chantier #26) : 2 à 5 donjons dans une publication
    const [multiDungeons, setMultiDungeons] = useState<MultiDungeonSelection[] | null>(null);
    const [isMultiOpen, setIsMultiOpen] = useState(false);

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
    const [maxMembers, setMaxMembers] = useState(4);
    const [message, setMessage] = useState("");
    const [targetDate, setTargetDate] = useState("");
    const [requiredClasses, setRequiredClasses] = useState<string[]>([]);
    const [isDiscordPublished, setIsDiscordPublished] = useState(false);
    const [mentionRoleIds, setMentionRoleIds] = useState<string[]>([]);
    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color: string }[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [roleOpen, setRoleOpen] = useState(false);
    const [targetChannelName, setTargetChannelName] = useState<string>("annonces");

    const [isPending, startTransition] = useTransition();

    // Reset all state on open, and re-check isDiscordConfigured when it changes
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setMode(initialQuestName ? "QUETE" : "DONJON");
            setDungeonSearch("");
            setSelectedDungeon(null);
            setSelectedAchievements([]);
            setQuestSearchQuery(initialQuestName || "");
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
            setMentionRoleIds([]);
            setMultiDungeons(null);
            setIsMultiOpen(false);
        }
    }, [isOpen, isDiscordConfigured, initialQuestName]);

    // Fetch Discord Roles and auto-fill whitelisted ping roles
    useEffect(() => {
        if (isOpen && isDiscordPublished && discordRoles.length === 0) {
            setIsLoadingRoles(true);
            getDiscordRolesAction(guildId, { context: "dj" })
                .then(res => {
                    if (res.success && res.roles) {
                        const filtered = res.roles.filter(r => r.name !== "@everyone") as any;
                        setDiscordRoles(filtered);
                        // No auto-selection: default = aucun rôle pingé
                        // L'utilisateur doit choisir explicitement
                    }
                })
                .catch(console.error)
                .finally(() => setIsLoadingRoles(false));
        }
    }, [isOpen, isDiscordPublished, guildId, discordRoles.length]);

    // Fetch Target Channel Name
    useEffect(() => {
        if (isOpen && isDiscordPublished) {
            getDungeonFinderConfig(guildId).then(res => {
                if (res.success && res.data?.djNotifyChannelId) {
                    getDiscordChannelInfo(guildId, res.data.djNotifyChannelId).then(chanRes => {
                        if (chanRes.success && chanRes.data) {
                            setTargetChannelName(chanRes.data.name);
                        }
                    });
                }
            });
        }
    }, [isOpen, isDiscordPublished, guildId]);

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
            const proxyUrl = `/api/dofusdb/quests?q=${encodeURIComponent(questSearchQuery.trim())}&limit=8`;
            fetch(proxyUrl, { signal: controller.signal })
                .then(res => {
                    if (!res.ok) throw new Error("Proxy DofusDB indisponible");
                    return res.json();
                })
                .then(data => {
                    if (data.data) {
                        setQuestSearchResults(data.data);
                        
                        // Casing & accent-insensitive exact matching
                        const cleanStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                        const targetClean = cleanStr(questSearchQuery);
                        const match = data.data.find((q: any) => cleanStr(q.name?.fr || "") === targetClean);
                        if (match) {
                            setSelectedQuest({ id: match.id, name: match.name?.fr || "" });
                        }
                    }
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
            const linkedProxyUrl = `/api/dofusdb/quests?q=${encodeURIComponent(linkedQuestSearch.trim())}&limit=6`;
            fetch(linkedProxyUrl, { signal: controller.signal })
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

    // ── Blocage SUIVANT/CONFIRMER : message clair « pourquoi / à quel endroit » ──
    const multiActive = (multiDungeons?.length ?? 0) >= 2;
    const blockReason = (() => {
        if (isPending) return null;
        if (!multiActive && mode === "DONJON" && !selectedDungeon) return "Sélectionne un donjon dans la liste ci-dessus.";
        if (!multiActive && mode === "QUETE" && !selectedQuest) return "Choisis une quête dans la recherche ci-dessus.";
        if (!multiActive && !targetDate) return "Renseigne le champ « Date & Heure prévue » ci-dessus.";
        return null;
    })();

    async function handleSubmit() {
        if (step < 2) {
            setStep(2);
            return;
        }

        // Mode multi-donjons (chantier #26) : 2 à 5 donjons → UNE publication.
        if (multiDungeons && multiDungeons.length >= 2) {
            if (step === 2 && isDiscordConfigured) {
                setStep(3);
                return;
            }
            const input = {
                posts: multiDungeons.map((s) => ({
                    dungeonId: s.dungeon.id,
                    wantedAchievementIds: s.achievements,
                    message: s.message ? s.message : null,
                    targetDate: s.targetDate ? new Date(s.targetDate) : null,
                })),
                maxMembers,
                requiredClasses,
                isDiscordPublished,
                mentionRoleIds,
            };
            startTransition(async () => {
                const res = await createDjPosts(guildId, input);
                if (res.success) {
                    toast.success("Vos recherches de groupe sont en ligne !");
                    handleClose();
                    onCreated();
                } else {
                    toast.error(res.error || "Erreur lors de la publication.");
                }
            });
            return;
        }

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

        if (step === 2 && isDiscordConfigured) {
            setStep(3);
            return;
        }

        const input = {
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
            mentionRoleIds,
        };

        startTransition(async () => {
            const res = await createDjPost(guildId, input);

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
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="w-[min(95vw,42rem)] max-w-[42rem] sm:min-w-[34rem] bg-background border border-border rounded-2xl text-foreground max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
                <div className="p-6 pb-4 border-b border-border bg-surface/40 shrink-0">
                    <DialogTitle className="text-xl font-black flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-warning" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl tracking-tight text-foreground leading-none">
                                {mode === "DONJON" ? "Nouveau Groupe Donjon" : "Nouveau Groupe Quête"}
                            </span>
                            <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest mt-1">
                                Planifier une session de guilde
                            </span>
                        </div>
                    </DialogTitle>
                </div>

                {/* Content Area — seule cette partie scrolle (header fixe, footer atteignable) */}
                <div className="p-6 flex-1 overflow-y-auto premium-scrollbar min-h-0">
                        {step === 1 && (
                            <div className="space-y-6">
                                {/* Mode Selector - Refined */}
                                <div className="grid grid-cols-2 relative bg-surface/80 border border-border p-1 rounded-xl w-full">
                                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-elevated border border-border rounded-xl transition-all duration-300 ease-out z-0 ${mode === "QUETE" ? "translate-x-full" : "translate-x-0"}`} />
                                    <button
                                        onClick={() => setMode("DONJON")}
                                        className={`relative z-10 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${mode === "DONJON" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <Swords className={`w-4 h-4 transition-colors ${mode === "DONJON" ? "text-warning" : ""}`} />
                                        Mode Donjons
                                    </button>
                                    <button
                                        onClick={() => setMode("QUETE")}
                                        className={`relative z-10 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${mode === "QUETE" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <Map className={`w-4 h-4 transition-colors ${mode === "QUETE" ? "text-success" : ""}`} />
                                        Mode Quêtes
                                    </button>
                                </div>

                                {/* Donjon Search */}
                                {mode === "DONJON" && (
                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-warning transition-colors" />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={dungeonSearch}
                                                onChange={(e) => setDungeonSearch(e.target.value)}
                                                placeholder="Rechercher un donjon ou un boss..."
                                                className="w-full bg-surface/60 border border-border focus:border-warning/50 rounded-xl pl-11 pr-4 py-3.5 text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
                                            />
                                        </div>

                                        {loadingDungeons ? (
                                            <div className="py-16 text-center text-muted-foreground bg-surface/30 rounded-3xl border border-border">
                                                Consultation du bestiaire...
                                            </div>
                                        ) : (
                                            <div className="h-72 overflow-y-auto space-y-2 pr-2 premium-scrollbar p-1">
                                                {filteredDungeons.length === 0 ? (
                                                    <div className="text-center py-20 bg-surface/30 rounded-3xl border border-border border-dashed">
                                                        <Search className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                                                        <p className="text-muted-foreground text-sm">Aucun donjon trouvé pour "{dungeonSearch}"</p>
                                                    </div>
                                                ) : filteredDungeons.map((d) => (
                                                    <button
                                                        key={d.id}
                                                        onClick={() => { setSelectedDungeon(d); setStep(2); }}
                                                        className="w-full flex items-center gap-4 p-3 rounded-2xl bg-surface/40 border border-border hover:border-warning/30 hover:bg-elevated transition-all group text-left relative overflow-hidden"
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-r from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-background border border-border shrink-0 relative z-10">
                                                            {d.imageUrl
                                                                ? <img src={d.imageUrl} alt={d.bossName} className="w-full h-full object-contain p-1 group- transition-transform duration-300" />
                                                                : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Swords className="w-6 h-6" /></div>}
                                                        </div>
                                                        <div className="flex-1 min-w-0 relative z-10">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-black text-foreground group-hover:text-foreground transition-colors truncate">{d.name}</p>
                                                                {d.isOcreQuest && (
                                                                    <img
                                                                        src="/module-dofus/Dofus_Ocre.png"
                                                                        alt="Quête Ocre"
                                                                        title="Donjon de la Quête Ocre"
                                                                        className="w-4 h-4 object-contain shrink-0"
                                                                    />
                                                                )}
                                                                <span className="text-caption font-black bg-warning/10 text-warning px-1.5 py-0.5 rounded border border-warning/20 shrink-0">Lvl {d.level}</span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-0.5 truncate group-hover:text-muted-foreground">{d.bossName}</p>
                                                        </div>
                                                        <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 translate-x-4 relative z-10 border border-border">
                                                            <Plus className="w-4 h-4 text-foreground" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Mode multi-donjons (2 à 5) — chantier #26 */}
                                {mode === "DONJON" && (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-surface/40">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                                                <Layers className="w-4 h-4 text-warning" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-foreground">Lancer un multi-donjons</p>
                                                <p className="text-caption text-muted-foreground">2 à 5 donjons dans une seule publication, un seul ping</p>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => setIsMultiOpen(true)} className="h-9 px-4 rounded-xl text-caption font-black uppercase tracking-wider shrink-0">
                                            {multiDungeons ? `Modifier (${multiDungeons.length})` : "Choisir"}
                                        </Button>
                                    </div>
                                )}

                                {/* Quête Search */}
                                {mode === "QUETE" && (
                                    <div className="space-y-4">
                                        <div className="space-y-4 p-4 bg-surface rounded-xl border border-border">
                                            <div className="relative z-50">
                                                <p className="text-sm font-bold text-foreground mb-2">Rechercher une quête</p>

                                                {selectedQuest ? (
                                                    <div className="flex items-center justify-between bg-info/10 border border-info/30 rounded-lg p-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <CheckCircle2 className="w-5 h-5 text-info shrink-0" />
                                                            <span className="text-sm font-bold text-info truncate">{selectedQuest.name}</span>
                                                            {selectedQuest.id === -1 && <span className="text-caption bg-elevated px-2 py-0.5 rounded text-muted-foreground font-mono border border-border shrink-0">Saisie Libre</span>}
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedQuest(null)} className="text-muted-foreground hover:text-foreground shrink-0 ml-2">Modifier</Button>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={questSearchQuery}
                                                            onChange={(e) => setQuestSearchQuery(e.target.value)}
                                                            placeholder="Ex: L'Étoile du Gerbé..."
                                                            className="w-full bg-surface/60 hover:bg-surface/80 border border-border focus:border-info/50 rounded-xl pl-9 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-info/10 transition-all placeholder:text-muted-foreground shadow-xl"
                                                        />

                                                        {questSearchQuery.trim().length > 0 && (
                                                            <div className="mt-3 bg-surface/50 border border-border rounded-xl overflow-hidden premium-scrollbar max-h-64 overflow-y-auto relative shadow-inner">
                                                                <button
                                                                    onClick={() => setSelectedQuest({ id: -1, name: questSearchQuery.trim() })}
                                                                    className="w-full text-left px-4 py-3 text-sm font-bold text-info bg-info/20 hover:bg-info/40 transition-colors border-b border-border/50 flex items-center gap-2"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                    Saisir manuellement "{questSearchQuery}"
                                                                </button>

                                                                {questSearchQuery.length >= 3 && (
                                                                    <>
                                                                        {isSearchingQuests && <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><div className="w-4 h-4 border-2 border-border border-t-indigo-500 rounded-full animate-spin" /> Recherche Base de Données...</div>}

                                                                        {!isSearchingQuests && questSearchResults.length === 0 && (
                                                                            <div className="p-4 text-sm text-muted-foreground">Aucune quête officielle trouvée sur DofusDB.</div>
                                                                        )}

                                                                        {!isSearchingQuests && questSearchResults.map(q => (
                                                                            <button
                                                                                key={q.id}
                                                                                onClick={() => setSelectedQuest({ id: q.id, name: q.name?.fr || "" })}
                                                                                className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted hover:text-foreground transition-colors border-b border-border/50 last:border-0 flex gap-3 truncate"
                                                                            >
                                                                                <span className="text-muted-foreground font-mono text-caption w-10 shrink-0 pt-0.5">#{q.id}</span>
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
                                            className="w-full h-12 text-sm bg-info hover:bg-info font-bold disabled:opacity-50"
                                            disabled={!selectedQuest}
                                            onClick={() => setStep(2)}
                                        >
                                            Suivant
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                {multiDungeons && multiDungeons.length >= 2 ? (
                                    <div className="flex items-center justify-between gap-3 bg-surface/60 rounded-3xl p-5 border border-border">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
                                                <Layers className="w-5 h-5 text-warning" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-foreground text-base truncate">{multiDungeons.length} donjons sélectionnés</p>
                                                <p className="text-caption text-muted-foreground truncate">{multiDungeons.map(s => s.dungeon.name).join(" · ")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => { setMultiDungeons(null); setSelectedDungeon(null); setSelectedAchievements([]); setTargetDate(""); setStep(1); }}
                                                title="Revenir au mode simple (un donjon ou une quête)"
                                                className="h-9 px-3 rounded-xl text-caption font-black whitespace-nowrap text-muted-foreground hover:text-warning bg-surface hover:bg-surface"
                                            >
                                                <X className="w-3 h-3 mr-1" /> Mode simple
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsMultiOpen(true)}
                                                className="h-9 px-4 rounded-xl text-caption font-black whitespace-nowrap text-muted-foreground hover:text-foreground bg-surface hover:bg-surface"
                                            >
                                                MODIFIER
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4 bg-surface/60 rounded-3xl p-5 border border-border shadow-xl relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-warning/5 to-transparent opacity-50" />
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border relative z-10 ${mode === "DONJON" ? "bg-background border-border" : "bg-success/30 border-success/20"}`}>
                                            {mode === "DONJON" && selectedDungeon?.imageUrl ? (
                                                <img src={selectedDungeon.imageUrl} alt="" className="w-10 h-10 object-contain group- transition-transform duration-300" />
                                            ) : mode === "DONJON" ? (
                                                <Swords className="w-6 h-6 text-muted-foreground" />
                                            ) : (
                                                <Map className="w-6 h-6 text-success" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 relative z-10">
                                            <p className="font-black text-foreground text-lg tracking-tight truncate leading-tight">
                                                {mode === "DONJON" ? selectedDungeon?.name : selectedQuest?.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {mode === "DONJON" ? (
                                                    <>
                                                        <span className="text-caption font-black bg-warning/10 text-warning px-1.5 py-0.5 rounded border border-warning/20">NIVEAU {selectedDungeon?.level}</span>
                                                        <span className="text-caption font-medium text-muted-foreground truncate">{selectedDungeon?.bossName}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-caption font-black bg-success/10 text-success px-1.5 py-0.5 rounded border border-success/20 uppercase tracking-widest">GROUPE QUÊTE</span>
                                                )}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="h-9 px-4 rounded-xl text-xs font-black text-muted-foreground hover:text-foreground bg-surface hover:bg-surface shrink-0 relative z-10">
                                            RETOUR
                                        </Button>
                                    </div>
                                )}

                                {/* Résumé multi-donjons : succès / date / note par donjon */}
                                {multiDungeons && multiDungeons.length >= 2 && (
                                    <div className="space-y-2">
                                        {multiDungeons.map((s) => (
                                            <div key={s.dungeon.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-3 rounded-xl bg-surface/40 border border-border">
                                                <span className="text-xs font-bold text-foreground truncate">{s.dungeon.name}</span>
                                                <span className="text-caption text-muted-foreground">
                                                    {s.achievements.length > 0 ? `${s.achievements.length} succès` : "sans succès"}
                                                    {s.targetDate ? ` · ${new Date(s.targetDate).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : ""}
                                                </span>
                                                {s.message && <span className="text-caption text-muted-foreground truncate">· {s.message}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Dynamic Fields depending on Mode */}
                                {!multiDungeons && mode === "DONJON" && selectedDungeon?.achievements.length ? (
                                    <div className="space-y-3">
                                        <p className="text-caption font-black text-muted-foreground uppercase tracking-widest ml-1">Succès visés (optionnel)</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedDungeon.achievements.map((a) => {
                                                const selected = selectedAchievements.includes(a.id);
                                                return (
                                                    <button
                                                        key={a.id}
                                                        onClick={() => toggleAchievement(a.id)}
                                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-caption font-bold transition-all ${selected
                                                            ? "border-warning/40 bg-warning/10 text-warning shadow-lg shadow-amber-900/5"
                                                            : "border-border bg-surface/50 hover:bg-elevated text-muted-foreground hover:text-foreground"
                                                            }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${selected ? "bg-warning/20 border-warning/20" : "bg-background border-border"}`}>
                                                            {a.challenge.iconUrl ? <img src={a.challenge.iconUrl} alt="" className="w-5 h-5 object-contain" /> : <Trophy className="w-4 h-4" />}
                                                        </div>
                                                        <span className="flex-1 text-left truncate">{a.challenge.name}</span>
                                                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-warning" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : mode === "QUETE" && (
                                    <div className="space-y-3">
                                        <p className="text-caption font-black text-muted-foreground uppercase tracking-widest ml-1">Lien vers un Tutoriel (Optionnel)</p>
                                        <div className="relative group">
                                            <Map className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-success transition-colors" />
                                            <input
                                                type="url"
                                                value={questUrl}
                                                onChange={(e) => setQuestUrl(e.target.value)}
                                                placeholder="Ex: https://www.dofuspourlesnoobs.com/..."
                                                className="w-full bg-surface/60 hover:bg-surface/80 border border-border focus:border-success/50 rounded-xl pl-11 pr-4 py-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-success/10 transition-all placeholder:text-muted-foreground shadow-xl"
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
                                            className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-info transition-colors"
                                        >
                                            <Map className="w-3.5 h-3.5" />
                                            {showLinkedQuest ? "▼ Masquer la quête liée" : "▶ Associer une quête (optionnel)"}
                                        </button>
                                        {showLinkedQuest && (
                                            <div className="bg-surface/60 border border-border/60 rounded-xl p-3 space-y-2">
                                                {linkedQuest ? (
                                                    <div className="flex items-center justify-between bg-info/10 border border-info/20 rounded-lg px-3 py-2">
                                                        <span className="text-sm text-info font-medium flex items-center gap-2">
                                                            <Map className="w-3.5 h-3.5" />
                                                            {linkedQuest.name}
                                                        </span>
                                                        <button onClick={() => setLinkedQuest(null)} className="text-muted-foreground hover:text-danger text-xs">✕</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={linkedQuestSearch}
                                                            onChange={e => setLinkedQuestSearch(e.target.value)}
                                                            placeholder="Rechercher une quête sur DofusDB..."
                                                            className="w-full bg-surface/60 hover:bg-surface/80 border border-border focus:border-info/50 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-info/10 transition-all placeholder:text-muted-foreground shadow-xl"
                                                        />
                                                        {isSearchingLinkedQuest && <p className="text-xs text-muted-foreground">Recherche...</p>}
                                                        {linkedQuestResults.length > 0 && (
                                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                {linkedQuestResults.map(q => (
                                                                    <button key={q.id} type="button"
                                                                        onClick={() => { setLinkedQuest({ id: q.id, name: q.name?.fr || "" }); setLinkedQuestResults([]); setLinkedQuestSearch(""); }}
                                                                        className="w-full text-left px-3 py-1.5 rounded-lg bg-elevated hover:bg-muted text-sm text-foreground transition-colors"
                                                                    >
                                                                        {q.name?.fr}
                                                                        {q.levelMin && <span className="text-xs text-muted-foreground ml-2">Niv. {q.levelMin}</span>}
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
                                <div className={`grid gap-6 ${multiDungeons ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                                    {!multiDungeons && (
                                        <div className="space-y-3">
                                            <p className="text-caption font-black text-muted-foreground uppercase tracking-widest ml-1">Date & Heure prévue</p>
                                            <DateTimePicker
                                                value={targetDate}
                                                onChange={setTargetDate}
                                                minDate={new Date()}
                                                placeholder="Choisir date & heure"
                                                timeOptional={true}
                                            />
                                            {!targetDate && (
                                                <p className="text-caption text-warning/90 font-bold ml-1">Date requise pour continuer.</p>
                                            )}
                                        </div>
                                    )}
                                    <div className="space-y-3">
                                        <p className="text-caption font-black text-muted-foreground uppercase tracking-widest ml-1">Taille du groupe</p>
                                        <div className="flex bg-surface border border-border rounded-xl p-1 h-[52px] items-center">
                                            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                                <button
                                                    key={n}
                                                    onClick={() => setMaxMembers(n)}
                                                    className={`flex-1 flex justify-center items-center h-full text-xs font-black transition-all rounded-xl ${maxMembers === n ? "bg-elevated text-foreground border border-border shadow-lg" : "text-muted-foreground hover:text-muted-foreground hover:bg-surface"}`}
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
                                        <p className="text-caption font-black text-muted-foreground uppercase tracking-widest">Besoin spécifique (Options)</p>
                                        <span className="text-caption font-bold text-muted-foreground uppercase whitespace-nowrap bg-surface px-3 py-0.5 rounded border border-border">{requiredClasses.length} sél.</span>
                                    </div>
                                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 p-4 rounded-3xl bg-surface/40 border border-border">
                                        {DOFUS_CLASSES.map((c) => {
                                            const isSelected = requiredClasses.includes(c.name);
                                            return (
                                                <button
                                                    key={c.id}
                                                    title={c.name}
                                                    onClick={() => toggleClass(c.name)}
                                                    className={`aspect-square rounded-xl flex items-center justify-center transition-colors border group/class ${isSelected 
                                                        ? "border-warning/50 bg-warning/10" 
                                                        : "border-transparent opacity-30 hover:opacity-100 hover:bg-elevated hover:border-border"}`}
                                                >
                                                    <img src={c.icon} alt={c.name} className="w-9 h-9 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Message */}
                                {!multiDungeons && (
                                <div className="space-y-3">
                                    <p className="text-caption font-black text-muted-foreground uppercase tracking-widest ml-1">Note pour la guilde</p>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={3}
                                        placeholder="Ex: On cherche un tank pour clean les succès du premier coup..."
                                        className="w-full bg-surface/60 hover:bg-surface/80 border border-border focus:border-warning/50 focus:ring-2 focus:ring-warning/10 rounded-2xl px-5 py-4 text-sm text-foreground focus:outline-none transition-all resize-none shadow-xl placeholder:text-muted-foreground"
                                    />
                                </div>
                                )}

                                {/* Footer Action - Details Step */}
                                <div className="pt-8 border-t border-border mt-4">
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setStep(1)}
                                            className="h-12 px-8 rounded-xl text-caption font-black text-muted-foreground hover:text-foreground transition-all uppercase tracking-[0.2em] border border-border hover:bg-surface order-2 sm:order-1"
                                        >
                                            Retour
                                        </Button>
                                        <Button
                                            className={`flex-1 h-12 px-10 rounded-xl font-black text-caption tracking-[0.2em] transition-all active:scale-95 shadow-xl relative group overflow-hidden order-1 sm:order-2 ${
                                                mode === "DONJON" 
                                                    ? "bg-warning hover:bg-warning text-warning-foreground shadow-amber-900/20" 
                                                    : "bg-success hover:bg-success text-success-foreground shadow-emerald-900/20"
                                            }`}
                                            onClick={() => setStep(3)}
                                            disabled={isPending || !!blockReason}
                                        >
                                            <div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-10 transition-opacity" />
                                            <div className="flex items-center justify-center gap-3 relative z-10 uppercase">
                                                {isPending ? (
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" />
                                                )}
                                                {isPending ? "PUBLICATION..." : "SUIVANT"}
                                            </div>
                                        </Button>
                                    </div>
                                    {blockReason && (
                                        <p className="text-caption font-bold text-warning/90 text-center mt-3 flex items-center justify-center gap-1.5">
                                            <AlertTriangle className="w-3 h-3 shrink-0" /> {blockReason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="text-center space-y-3 mb-8">
                                    <div className="w-16 h-16 rounded-3xl bg-info/10 border border-info/20 flex items-center justify-center mx-auto ">
                                        <Hash className="w-8 h-8 text-info" />
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Configuration Discord</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">Voulez-vous notifier la guilde de cette session sur Discord ?</p>
                                </div>

                                <div className={`p-6 rounded-3xl border transition-all duration-300 ${isDiscordPublished ? 'bg-info/10 border-info/30' : 'bg-surface/50 border-border'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-black uppercase tracking-widest ${isDiscordPublished ? 'text-info' : 'text-foreground'}`}>Synchro Automatique</span>
                                            {isDiscordPublished ? (
                                                <div className="flex items-center gap-1 mt-1 animate-in fade-in">
                                                    <Hash className="w-3 h-3 text-info/70" />
                                                    <span className="text-caption text-info/70 font-bold uppercase tracking-widest">Sera posté dans #{targetChannelName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest mt-1">Désactivé</span>
                                            )}
                                        </div>
                                        <Switch
                                            checked={isDiscordPublished && isDiscordConfigured}
                                            onCheckedChange={setIsDiscordPublished}
                                            disabled={!isDiscordConfigured}
                                            className="data-[state=checked]:bg-info scale-125 origin-right"
                                        />
                                    </div>

                                    {!isDiscordConfigured && (
                                        <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-3">
                                            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                                            <p className="text-caption text-warning/70 font-bold uppercase tracking-wider">
                                                Discord non configuré pour ce module. Contactez un admin.
                                            </p>
                                        </div>
                                    )}

                                    {isDiscordPublished && discordRoles.length > 0 && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-8 pt-6 border-t border-warning/20 space-y-3">
                                            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-warning/8 border border-warning/20">
                                                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                                                <p className="text-caption text-warning/80 font-medium leading-relaxed">
                                                    <span className="font-bold text-warning">Aucun ping par défaut.</span> Sans sélection, personne ne sera notifié. Pinge un rôle pour que ton post soit visible.
                                                </p>
                                            </div>
                                            <span className="text-caption font-black text-warning/70 uppercase tracking-widest ml-1">Mentionner un rôle (Ping)</span>
                                            <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={roleOpen}
                                                        className="h-14 bg-background/50 border-border text-sm font-bold rounded-2xl justify-between group/role w-full hover:bg-background px-4"
                                                    >
                                                        <div className="flex items-center gap-3 truncate">
                                                            {mentionRoleIds.length > 0 ? (
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {mentionRoleIds.slice(0, 3).map(id => {
                                                                        const role = discordRoles.find(r => r.id === id);
                                                                        if (!role) return null;
                                                                        const roleColor = role.color === "#000000" ? "#9ca3af" : role.color;
                                                                        return (
                                                                            <div 
                                                                                key={id} 
                                                                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all"
                                                                                style={{ 
                                                                                    backgroundColor: `${roleColor}15`, 
                                                                                    borderColor: `${roleColor}40`,
                                                                                    color: roleColor 
                                                                                }}
                                                                            >
                                                                                <div 
                                                                                    className="w-1.5 h-1.5 rounded-full shrink-0 " 
                                                                                    style={{ backgroundColor: roleColor }} 
                                                                                />
                                                                                <span className="text-caption font-bold uppercase truncate max-w-[80px]">{role.name}</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setMentionRoleIds(prev => prev.filter(rid => rid !== id));
                                                                                    }}
                                                                                    className="ml-0.5 hover:bg-elevated rounded-full p-0.5 transition-colors"
                                                                                >
                                                                                    <X className="h-2.5 w-2.5" />
                                                                                </button>
                                                                            </div>
                                                                        );
                                                        })}
                                                        {mentionRoleIds.length > 3 && (
                                                            <span className="text-caption font-bold text-muted-foreground uppercase tracking-wide px-1.5">
                                                                +{mentionRoleIds.length - 3} rôles
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                                <span className="text-muted-foreground italic">Aucun ping (recommandé si petit besoin)</span>
                                                            )}
                                                        </div>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-background border border-border shadow-2xl rounded-2xl overflow-hidden" align="center" sideOffset={8}>
                                                    <Command className="bg-transparent text-foreground">
                                                        <CommandInput placeholder="Rechercher un rôle..." className="h-12 border-none focus:ring-0 text-sm" />
                                                        <CommandList className="max-h-[320px] premium-scrollbar p-2">
                                                            <CommandEmpty>Aucun rôle.</CommandEmpty>
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    onSelect={() => {
                                                                        setMentionRoleIds([]);
                                                                    }}
                                                                    className="text-muted-foreground italic focus:bg-surface cursor-pointer text-xs py-3 px-3 rounded-xl flex items-center justify-between group"
                                                                >
                                                                    <span className="font-bold uppercase tracking-widest">Aucun ping</span>
                                                                    {mentionRoleIds.length === 0 && <Check className="h-4 w-4 text-muted-foreground" />}
                                                                </CommandItem>
                                                                {discordRoles.map((role) => (
                                                                    <CommandItem
                                                                        key={role.id}
                                                                        onSelect={() => {
                                                                            setMentionRoleIds(prev => 
                                                                                prev.includes(role.id) 
                                                                                    ? prev.filter(id => id !== role.id) 
                                                                                    : [...prev, role.id]
                                                                            );
                                                                        }}
                                                                        className="text-foreground focus:bg-surface cursor-pointer text-xs py-3 px-3 rounded-xl flex items-center justify-between group mt-1"
                                                                    >
                                                                        <div className="flex items-center gap-3 flex-1 truncate font-black tracking-tight uppercase">
                                                                            <div 
                                                                                className="w-2.5 h-2.5 rounded-full shrink-0 " 
                                                                                style={{ 
                                                                                    backgroundColor: role.color === "#000000" ? "#9ca3af" : role.color,
                                                                                    color: role.color === "#000000" ? "#9ca3af" : role.color
                                                                                }} 
                                                                            />
                                                                            <span className="truncate group-hover:translate-x-1 transition-transform">{role.name}</span>
                                                                        </div>
                                                                        {mentionRoleIds.includes(role.id) && <Check className="h-4 w-4 text-info shrink-0" />}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <PingEstimate guildId={guildId} roleIds={mentionRoleIds} className="ml-1" />
                                        </motion.div>
                                    )}
                                </div>

                                <div className="pt-8 border-t border-border mt-4">
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setStep(2)}
                                            className="h-12 px-8 rounded-xl text-caption font-black text-muted-foreground hover:text-foreground transition-all uppercase tracking-[0.2em] border border-border hover:bg-surface order-2 sm:order-1"
                                        >
                                            Retour
                                        </Button>
                                        <Button
                                            className={`flex-1 h-12 px-10 rounded-xl font-black text-caption tracking-[0.2em] transition-all active:scale-95 shadow-xl relative group overflow-hidden order-1 sm:order-2 ${
                                                mode === "DONJON" 
                                                    ? "bg-warning hover:bg-warning text-warning-foreground shadow-amber-900/20" 
                                                    : "bg-success hover:bg-success text-success-foreground shadow-emerald-900/20"
                                            }`}
                                            onClick={handleSubmit}
                                            disabled={isPending || !!blockReason}
                                        >
                                            <div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-10 transition-opacity" />
                                            <div className="flex items-center justify-center gap-3 relative z-10 uppercase">
                                                {isPending ? (
                                                    <div className="w-4 h-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                )}
                                                {isPending ? "PUBLICATION..." : "CONFIRMER & LANCER"}
                                            </div>
                                        </Button>
                                    </div>
                                    {blockReason && (
                                        <p className="text-caption font-bold text-warning/90 text-center mt-3 flex items-center justify-center gap-1.5">
                                            <AlertTriangle className="w-3 h-3 shrink-0" /> {blockReason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                </div>
            </DialogContent>
            </Dialog>

            {/* Modale multi-donjons (SIBLING du Dialog parent — évite l'imbrication
                de Dialog Radix qui provoquait une couche/largeur résiduelle) */}
            <DjMultiDungeonModal
                isOpen={isMultiOpen}
                initial={multiDungeons ?? undefined}
                onClose={() => setIsMultiOpen(false)}
                onConfirm={(selections) => {
                    setMultiDungeons(selections);
                    setIsMultiOpen(false);
                    if (step < 2) setStep(2);
                }}
            />
        </>
    );
}
