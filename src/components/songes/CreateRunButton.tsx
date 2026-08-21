"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, MessageSquare, Trophy, Swords, Timer, Calendar as CalendarIcon, Clock, ChevronsUpDown, Check, Hash, ChevronRight, AlertTriangle, X, User } from "lucide-react";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createDreamRun } from "@/server/actions/songes/dream-run-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { getDiscordChannelInfo } from "@/server/actions/discord-actions";
import { PingEstimate } from "@/components/shared/ping-estimate";
import { getStuffGalleryPage, type GalleryBuild } from "@/server/actions/gallery-actions";
import { DIFFICULTIES, OBJECTIVES, EPREUVES_SONGE, type DifficultyKey, type ObjectiveKey, type EpreuveCode } from "@/lib/songes/types";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";

// Couleur selon difficulté
function getDifficultyBadgeColor(diffKey: DifficultyKey) {
    if (diffKey.startsWith("CAUCHEMAR")) return "text-danger bg-danger/20 border-danger/30";
    if (diffKey.startsWith("PARADOXE")) return "text-warning bg-warning/20 border-warning/30";
    return "text-success bg-success/20 border-success/30";
}


// Component
// ─────────────────────────────────────────────────────────
export function CreateRunButton({ guildId, isDiscordConfigured }: { guildId: string; isDiscordConfigured?: boolean }) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [mode, setMode] = useState<"standard" | "epreuve">("standard");

    useEffect(() => {
        if (open) {
            setStep(1);
        }
    }, [open]);

    // Standard mode
    const [difficulty, setDifficulty] = useState<DifficultyKey>("REVE_III");
    const [objectives, setObjectives] = useState<ObjectiveKey[]>([]);

    // Épreuve mode
    const [selectedEpreuve, setSelectedEpreuve] = useState<EpreuveCode | null>(null);

    // Shared
    const [publishToDiscord, setPublishToDiscord] = useState(!!isDiscordConfigured);
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
    const [scheduledTime, setScheduledTime] = useState("20:00");
    const [stuffs, setStuffs] = useState<GalleryBuild[]>([]);
    const [selectedStuffId, setSelectedStuffId] = useState<string>("none");
    const [customStuffName, setCustomStuffName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [rateLimitReset, setRateLimitReset] = useState<number | null>(null); // timestamp ms
    const [countdown, setCountdown] = useState<string | null>(null);
    const [mentionRoleIds, setMentionRoleIds] = useState<string[]>([]);
    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color: string }[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [roleOpen, setRoleOpen] = useState(false);
    const [targetChannelName, setTargetChannelName] = useState<string>("annonces");
    // Leader class selection
    const [leaderClass, setLeaderClass] = useState<string | null>(null);
    const [userMules, setUserMules] = useState<{ pseudo: string; classe: string }[]>([]);
    const [userMainClass, setUserMainClass] = useState<string | null>(null);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Countdown timer tick
    useEffect(() => {
        if (!rateLimitReset) { setCountdown(null); return; }
        const tick = () => {
            const remaining = rateLimitReset - Date.now();
            if (remaining <= 0) { setRateLimitReset(null); setCountdown(null); setError(null); return; }
            const m = Math.floor(remaining / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            setCountdown(m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [rateLimitReset]);

    // Fetch Discord Roles & Stuffs
    useEffect(() => {
        if (open) {
            if (publishToDiscord && discordRoles.length === 0) {
                setIsLoadingRoles(true);
                getDiscordRolesAction(guildId, { context: "songes" })
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
            if (stuffs.length === 0) {
                Promise.all([
                    getStuffGalleryPage(guildId),
                    import("@/server/actions/user-actions").then(m => m.getUserContext(guildId))
                ]).then(([res, userCtx]) => {
                    if (res.success && res.data && userCtx.profileId) {
                        setStuffs(res.data.builds.filter(s => s.author.id === userCtx.profileId));
                    }
                    // Populate user characters for class selection
                    if (userCtx && userCtx.profileId) {
                        const mainCls = (userCtx as any).classe || null;
                        setUserMainClass(mainCls);
                        const alts = ((userCtx as any).altPseudos as any[] || []).map((a: any) => ({
                            pseudo: typeof a === 'string' ? a : a.pseudo,
                            classe: typeof a === 'string' ? 'cra' : (a.classe || 'cra'),
                        }));
                        setUserMules(alts);
                        // Pre-select main class if no selection yet
                        if (!leaderClass && mainCls) {
                            setLeaderClass(mainCls);
                        }
                    }
                });
            }
        }
    }, [open, publishToDiscord, guildId, discordRoles.length, stuffs.length]);

    // Fetch Target Channel Name
    useEffect(() => {
        if (open && publishToDiscord) {
            import("@/server/actions/songes/dream-run-actions").then(m => {
                m.getSongesPublicConfig(guildId).then(res => {
                    if (res.success && res.data?.songesNotifyChannelId) {
                        getDiscordChannelInfo(guildId, res.data.songesNotifyChannelId).then(chanRes => {
                            if (chanRes.success && chanRes.data) {
                                setTargetChannelName(chanRes.data.name ?? "Salon masqué");
                            }
                        });
                    }
                });
            });
        }
    }, [open, publishToDiscord, guildId]);

    const handleCreate = () => {
        const selectedStuff = stuffs.find(s => s.id === selectedStuffId);
        if (mode === "standard") {
            if (objectives.length === 0) {
                setError("Veuillez sélectionner au moins un objectif.");
                return;
            }
            setError(null);
            startTransition(async () => {
                let scheduledAt: Date | null = null;
                if (isScheduled && scheduledDate) {
                    const [hours, minutes] = scheduledTime.split(":").map(Number);
                    scheduledAt = new Date(scheduledDate);
                    scheduledAt.setHours(hours, minutes, 0, 0);
                }

                const result = await createDreamRun(guildId, {
                    difficulty,
                    objectives, 
                    publishToDiscord,
                    scheduledAt,
                    mentionRoleIds,
                    linkedStuffId: selectedStuffId === "none" ? null : selectedStuffId,
                    linkedStuffName: customStuffName || selectedStuff?.name || null,
                    linkedStuffThumbnail: selectedStuff?.previewData?.thumbnail || null,
                    linkedStuffUrl: selectedStuff?.url || null,
                    leaderClass: leaderClass || undefined,
                });
                if (result.success) {
                    toast.success("Run créée avec succès !");
                    setOpen(false);
                    setObjectives([]);
                    router.refresh();
                } else if (result.resetAt) {
                    setRateLimitReset(result.resetAt);
                    toast.error("Limite atteinte", { description: "Tu as créé trop de runs récemment. Patiente un peu." });
                } else {
                    setError(result.error || "Erreur inconnue");
                }
            });
        } else {
            // Épreuve mode
            if (!selectedEpreuve) {
                setError("Veuillez sélectionner une épreuve.");
                return;
            }
            const epreuve = EPREUVES_SONGE.find(e => e.code === selectedEpreuve)!;
            setError(null);
            startTransition(async () => {
                let scheduledAt: Date | null = null;
                if (isScheduled && scheduledDate) {
                    const [hours, minutes] = scheduledTime.split(":").map(Number);
                    scheduledAt = new Date(scheduledDate);
                    scheduledAt.setHours(hours, minutes, 0, 0);
                }

                const result = await createDreamRun(guildId, {
                    difficulty: epreuve.difficulty,
                    objectives: ["SUCCES_NO_ACHAT"],
                    publishToDiscord,
                    epreuveCode: epreuve.code,
                    scheduledAt,
                    mentionRoleIds,
                    linkedStuffId: selectedStuffId === "none" ? null : selectedStuffId,
                    linkedStuffName: customStuffName || selectedStuff?.name || null,
                    linkedStuffThumbnail: selectedStuff?.previewData?.thumbnail || null,
                    linkedStuffUrl: selectedStuff?.url || null,
                    leaderClass: leaderClass || undefined,
                });
                if (result.success) {
                    toast.success(`Épreuve ${epreuve.code} lancée !`);
                    setOpen(false);
                    setSelectedEpreuve(null);
                    router.refresh();
                } else if (result.resetAt) {
                    setRateLimitReset(result.resetAt);
                    toast.error("Limite atteinte", { description: "Tu as créé trop de runs récemment. Patiente un peu." });
                } else {
                    setError(result.error || "Erreur inconnue");
                }
            });
        }
    };

    const toggleObjective = (obj: ObjectiveKey) => {
        setObjectives(prev =>
            prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]
        );
    };

    const isParadoxeOrMore = difficulty.startsWith("PARADOXE") || difficulty.startsWith("CAUCHEMAR");

    const availableObjectives = Object.entries(OBJECTIVES).filter(([key]) => {
        if (key === "FUN") return false;
        if (key === "DROP_LEGENDE" || key === "SUCCES_NO_ACHAT") return isParadoxeOrMore;
        return true;
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="h-14 px-8 text-lg bg-info hover:bg-info text-info-foreground gap-3 font-black uppercase tracking-wider flex-1 min-w-[240px] transition-colors">
                    <Plus className="w-6 h-6" />
                    Créer une Run
                </Button>
            </DialogTrigger>

            <DialogContent className="bg-background border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60 premium-scrollbar">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2 text-foreground">
                        🌙 Nouvelle Run Songes
                    </DialogTitle>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-4 pt-2">
                            <Tabs value={mode} onValueChange={(v) => { setMode(v as "standard" | "epreuve"); setError(null); }}>
                    <TabsList className="w-full bg-surface border border-white/8 p-1 rounded-lg mb-4">
                        <TabsTrigger
                            value="standard"
                            className="flex-1 gap-2 data-[state=active]:bg-info data-[state=active]:text-info-foreground data-[state=active]: text-info-foreground/50 font-bold uppercase tracking-wide text-xs transition-all rounded"
                        >
                            <Swords className="w-3.5 h-3.5" />
                            Run Standard
                        </TabsTrigger>
                        <TabsTrigger
                            value="epreuve"
                            className="flex-1 gap-2 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground data-[state=active]: text-warning-foreground/50 font-bold uppercase tracking-wide text-xs transition-all rounded"
                        >
                            <Trophy className="w-3.5 h-3.5" />
                            Épreuve de Songe
                        </TabsTrigger>
                    </TabsList>

                    {/* ─── MODE STANDARD ─── */}
                    <TabsContent value="standard" className="space-y-4 mt-0">
                        {/* Difficulty */}
                        <div className="space-y-2">
                            <Label className="text-foreground/60 text-xs uppercase tracking-widest font-bold">Difficulté</Label>
                            <Select value={difficulty} onValueChange={(v) => {
                                setDifficulty(v as DifficultyKey);
                                const isNewParadoxe = v.startsWith("PARADOXE") || v.startsWith("CAUCHEMAR");
                                if (!isNewParadoxe) {
                                    setObjectives(prev => prev.filter(o => o !== "DROP_LEGENDE" && o !== "SUCCES_NO_ACHAT"));
                                }
                            }}>
                                <SelectTrigger className="bg-surface border-border text-foreground hover:bg-white/8 transition-colors">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border">
                                    {Object.entries(DIFFICULTIES).map(([key, value]) => (
                                        <SelectItem key={key} value={key} className="text-foreground focus:bg-surface">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: value.couleur }} />
                                                {value.label}
                                                <span className="text-foreground/40 text-xs">({value.xpBonus}% XP/Butin)</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Objectives */}
                        <div className="space-y-2">
                            <Label className="text-foreground/60 text-xs uppercase tracking-widest font-bold">Objectifs (Choix multiple)</Label>
                            <div className="grid grid-cols-1 gap-1.5">
                                {availableObjectives.map(([key, value]) => {
                                    const isSelected = objectives.includes(key as ObjectiveKey);
                                    return (
                                        <div
                                            key={key}
                                            onClick={() => toggleObjective(key as ObjectiveKey)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                isSelected
                                                    ? "bg-info/25 border-info/60 text-info"
                                                    : "bg-white/3 border-white/8 text-foreground/50 hover:bg-white/6 hover:text-foreground/70"
                                            )}
                                        >
                                            <div className="text-lg">{value.icon}</div>
                                            <div className="text-sm font-medium">{value.label}</div>
                                            {isSelected && (
                                                <div className="ml-auto w-2 h-2 rounded-full bg-info " />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ─── MODE ÉPREUVE ─── */}
                    <TabsContent value="epreuve" className="mt-0">
                        <p className="text-xs text-foreground/30 mb-3 leading-relaxed">
                            Parcours prédéfinis liés à des succès en jeu. La difficulté et le mode sont imposés par l'épreuve choisie.
                        </p>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 premium-scrollbar">
                            {EPREUVES_SONGE.map((epreuve) => {
                                const isSelected = selectedEpreuve === epreuve.code;
                                const badgeColor = getDifficultyBadgeColor(epreuve.difficulty);
                                return (
                                    <div
                                        key={epreuve.code}
                                        onClick={() => setSelectedEpreuve(isSelected ? null : epreuve.code)}
                                        className={cn(
                                            "relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 group",
                                            isSelected
                                                ? "border-warning/50 bg-warning/15 "
                                                : "border-white/8 bg-white/3 hover:border-border-strong hover:bg-surface"
                                        )}
                                    >
                                        {/* Barre colorée latérale */}
                                        <div
                                            className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl transition-opacity"
                                            style={{
                                                backgroundColor: epreuve.color,
                                                opacity: isSelected ? 1 : 0.3,
                                            }}
                                        />

                                        {/* Icône */}
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all",
                                            isSelected ? "bg-warning/20 border border-warning/30" : "bg-surface border border-white/8"
                                        )}>
                                            {epreuve.icon}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={cn("text-sm font-bold", isSelected ? "text-warning" : "text-foreground/80")}>
                                                    {epreuve.label}
                                                </span>
                                                <span className={cn("text-caption font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", badgeColor)}>
                                                    {epreuve.difficultyLabel}
                                                </span>
                                            </div>
                                            <p className="text-caption text-foreground/35 leading-relaxed mt-0.5 line-clamp-2">
                                                {epreuve.description}
                                            </p>
                                            {/* Succès associé */}
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <Trophy className="w-3 h-3 text-warning/60" />
                                                <span className="text-caption text-warning/50 font-semibold">
                                                    Succès : Épreuve {epreuve.code}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Selected indicator */}
                                        {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-warning  shrink-0 mt-1" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </TabsContent>
                </Tabs>

                    {/* SCHEDULE & STUFF (Step 1 Shared) */}
                    {/* ─── SCHEDULE TOGGLE ─── */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-white/3">
                            <div className="flex items-center gap-3">
                                <CalendarIcon className="w-5 h-5 text-info" />
                                <div>
                                    <p className="text-sm font-medium text-foreground/80">Planifier la Run</p>
                                    <p className="text-xs text-foreground/35">Définir une date et une heure</p>
                                </div>
                            </div>
                            <Switch
                                checked={isScheduled}
                                onCheckedChange={setIsScheduled}
                                className="data-[state=checked]:bg-info"
                            />
                        </div>

                        {isScheduled && (
                            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="space-y-1.5">
                                    <Label className="text-caption text-foreground/40 uppercase font-bold ml-1">Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full h-10 justify-start text-left font-normal bg-surface border-border text-foreground hover:bg-white/8",
                                                    !scheduledDate && "text-foreground/40"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 text-info" />
                                                {scheduledDate ? format(scheduledDate, "d MMM yyyy", { locale: fr }) : "Choisir une date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-background border-border z-[200]" align="center">
                                            <Calendar
                                                mode="single"
                                                selected={scheduledDate}
                                                onSelect={setScheduledDate}
                                                disabled={(date) => date < new Date() && date.toDateString() !== new Date().toDateString()}
                                                initialFocus
                                                className="bg-transparent text-foreground"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-caption text-foreground/40 uppercase font-bold ml-1">Heure</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-3 h-4 w-4 text-info" />
                                        <Input
                                            type="time"
                                            value={scheduledTime}
                                            onChange={(e) => setScheduledTime(e.target.value)}
                                            className="h-10 pl-10 bg-surface border-border text-foreground focus:border-info/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Note épreuve */}
                    {mode === "epreuve" && selectedEpreuve && (
                        <p className="text-caption text-foreground/25 flex items-center gap-1.5">
                            <Trophy className="w-3 h-3 text-warning/40" />
                            Pas de butin ni d&apos;expérience pour les Épreuves.
                        </p>
                    )}

                    {/* CLASS SELECTION (Lead) */}
                    <div className="space-y-3 pt-2 border-t border-border">
                        <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                            ⚔️ Ta Classe pour cette Run
                        </Label>

                        {/* Mes Personnages (main + mules) */}
                        {(userMainClass || userMules.length > 0) && (
                            <div className="space-y-1.5">
                                <p className="text-caption text-foreground/35 uppercase font-bold tracking-widest flex items-center gap-1.5">
                                    <User className="w-3 h-3" /> Mes Personnages
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {/* Main character */}
                                    {userMainClass && (() => {
                                        const cls = getClass(userMainClass);
                                        if (!cls) return null;
                                        const isSelected = leaderClass === cls.id;
                                        return (
                                            <button
                                                key="main"
                                                type="button"
                                                onClick={() => setLeaderClass(cls.id)}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all",
                                                    isSelected
                                                        ? "border-info/60 bg-info/15 text-info "
                                                        : "border-white/8 bg-white/3 text-foreground/50 hover:border-border-strong hover:text-foreground/80"
                                                )}
                                            >
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cls.color}20` }}>
                                                    <NextImage src={cls.icon} alt={cls.name} width={18} height={18} className="object-contain" unoptimized />
                                                </div>
                                                <span>{cls.name}</span>
                                                <span className="text-caption text-foreground/25 uppercase">Main</span>
                                                {isSelected && <Check className="w-3 h-3 text-info" />}
                                            </button>
                                        );
                                    })()}
                                    {/* Mules */}
                                    {userMules.map((mule, i) => {
                                        const cls = getClass(mule.classe);
                                        if (!cls) return null;
                                        const isSelected = leaderClass === cls.id;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setLeaderClass(cls.id)}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all",
                                                    isSelected
                                                        ? "border-info/60 bg-info/15 text-info "
                                                        : "border-white/8 bg-white/3 text-foreground/50 hover:border-border-strong hover:text-foreground/80"
                                                )}
                                            >
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cls.color}20` }}>
                                                    <NextImage src={cls.icon} alt={cls.name} width={18} height={18} className="object-contain" unoptimized />
                                                </div>
                                                <span>{mule.pseudo}</span>
                                                {isSelected && <Check className="w-3 h-3 text-info" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Toutes les classes */}
                        <div className="space-y-1.5">
                            <p className="text-caption text-foreground/35 uppercase font-bold tracking-widest">Toutes les Classes</p>
                            <div className="flex flex-wrap gap-1.5 bg-white/3 rounded-xl p-2 border border-border">
                                {DOFUS_CLASSES.map((cls) => {
                                    const isSelected = leaderClass === cls.id;
                                    return (
                                        <button
                                            key={cls.id}
                                            type="button"
                                            title={cls.name}
                                            onClick={() => setLeaderClass(cls.id)}
                                            className={cn(
                                                "w-9 h-9 rounded-lg flex items-center justify-center transition-all border shrink-0",
                                                isSelected
                                                    ? "border-border-strong scale-110 z-10"
                                                    : "border-border bg-black/20 opacity-50 hover:opacity-100 hover:bg-surface"
                                            )}
                                            style={{
                                                backgroundColor: isSelected ? `${cls.color}20` : undefined,
                                                boxShadow: isSelected ? `0 0 12px ${cls.color}40, inset 0 0 0 1px ${cls.color}50` : 'none'
                                            }}
                                        >
                                            <NextImage src={cls.icon} alt={cls.name} width={22} height={22} className="object-contain" unoptimized />
                                        </button>
                                    );
                                })}
                            </div>
                            {leaderClass && (() => {
                                const cls = getClass(leaderClass);
                                return cls ? (
                                    <p className="text-caption text-center font-bold" style={{ color: cls.color }}>
                                        {cls.name} sélectionné(e)
                                    </p>
                                ) : null;
                            })()}
                        </div>
                    </div>

                    {!countdown && error && (
                        <div className="text-danger text-sm bg-danger/15 p-3 rounded-lg border border-danger/25">
                            {error}
                        </div>
                    )}

                    {/* Submit Step 1 */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="h-12 px-8 rounded-xl text-caption font-black text-muted-foreground hover:text-foreground transition-all uppercase tracking-[0.2em] border border-border hover:bg-surface order-2 sm:order-1"
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={() => {
                                if (mode === "standard" && objectives.length === 0) {
                                    setError("Veuillez sélectionner au moins un objectif.");
                                    return;
                                }
                                if (mode === "epreuve" && !selectedEpreuve) {
                                    setError("Veuillez sélectionner une épreuve.");
                                    return;
                                }
                                setError(null);
                                setStep(2);
                            }}
                            className={cn(
                                "flex-1 h-12 px-10 rounded-xl font-black text-caption tracking-[0.2em] transition-colors active:scale-95 relative group overflow-hidden order-1 sm:order-2",
                                mode === "epreuve"
                                    ? "bg-warning hover:bg-warning text-warning-foreground"
                                    : "bg-info hover:bg-info text-info-foreground"
                            )}
                        >
                            <div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-10 transition-opacity" />
                            <div className="flex items-center justify-center gap-3 relative z-10 uppercase">
                                <ChevronRight className="w-4 h-4" />
                                SUIVANT
                            </div>
                        </Button>
                    </div>
                </motion.div>
                )}

                {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className="text-center space-y-3 mb-8 pt-4">
                        <div className="w-16 h-16 rounded-3xl bg-info/10 border border-info/20 flex items-center justify-center mx-auto ">
                            <Hash className="w-8 h-8 text-info" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Configuration Discord</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">Notifier la guilde de votre run Songes ?</p>
                    </div>

                    <div className={`p-6 rounded-3xl border transition-all duration-300 ${publishToDiscord ? 'bg-info/10 border-info/30' : 'bg-surface/50 border-border'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className={`text-sm font-black uppercase tracking-widest ${publishToDiscord ? 'text-info' : 'text-foreground'}`}>Synchro Automatique</span>
                                {publishToDiscord ? (
                                    <div className="flex items-center gap-1 mt-1 animate-in fade-in">
                                        <Hash className="w-3 h-3 text-info/70" />
                                        <span className="text-caption text-info/70 font-bold uppercase tracking-widest">Sera posté dans #{targetChannelName}</span>
                                    </div>
                                ) : (
                                    <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest mt-1">Désactivé</span>
                                )}
                            </div>
                            <Switch
                                checked={publishToDiscord && isDiscordConfigured}
                                onCheckedChange={setPublishToDiscord}
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

                        {publishToDiscord && discordRoles.length > 0 && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-8 pt-6 border-t border-info/20 space-y-3">
                                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-warning/8 border border-warning/20">
                                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                                    <p className="text-caption text-warning/80 font-medium leading-relaxed">
                                        <span className="font-bold text-warning">Aucun ping par défaut.</span> Sans sélection, personne ne sera notifié. Choisissez un rôle pour que ta run ait de la visibilité.
                                    </p>
                                </div>
                                <span className="text-caption font-black text-info/70 uppercase tracking-widest ml-1">Mentionner un rôle (Ping)</span>
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
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-background border border-border shadow-2xl rounded-2xl overflow-hidden z-[200]" align="center" sideOffset={8}>
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
                                onClick={() => setStep(1)}
                                className="h-12 px-8 rounded-xl text-caption font-black text-muted-foreground hover:text-foreground transition-all uppercase tracking-[0.2em] border border-border hover:bg-surface order-2 sm:order-1"
                            >
                                Retour
                            </Button>
                            <Button
                                className={cn(
                                    "flex-1 h-12 px-10 rounded-xl font-black text-caption tracking-[0.2em] transition-colors active:scale-95 relative group overflow-hidden order-1 sm:order-2",
                                    mode === "epreuve" 
                                        ? "bg-warning hover:bg-warning text-warning-foreground" 
                                        : "bg-success hover:bg-success text-success-foreground"
                                )}
                                onClick={handleCreate}
                                disabled={isPending}
                            >
                                <div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-10 transition-opacity" />
                                <div className="flex items-center justify-center gap-3 relative z-10 uppercase">
                                    {isPending ? (
                                        <div className="w-4 h-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    {isPending ? "PUBLICATION..." : "CONFIRMER & LANCER"}
                                </div>
                            </Button>
                        </div>
                    </div>
                </motion.div>
                )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
