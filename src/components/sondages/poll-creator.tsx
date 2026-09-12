"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Plus,
    Sparkles,
    Clock,
    Users,
    Lock,
    Trash2,
    GripVertical,
    ChevronsUpDown,
    Check,
    Hash,
    ChevronRight,
    AlertTriangle,
    X,
    Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createPoll, acquirePollCreatorRole, getMicroStatus, releasePollCreatorRole } from "@/server/actions/poll-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { getDiscordChannelInfo } from "@/server/actions/discord-actions";
import { PingEstimate } from "@/components/shared/ping-estimate";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PollCreatorProps {
    guildId: string;
    // NB: les salons/rôles Discord sont désormais récupérés côté composant via
    // getPollSettings/getDiscordRolesAction (pattern DJ/songes) — plus de props.
    // Props conservées pour compatibilité d'appel, ignorées.
    discordChannels?: { id: string; name: string }[];
    discordRoles?: { id: string; name: string; color: number }[];
    initialMicroStatus: {
        holder: { id: string; name: string; image?: string } | null;
        expiresAt?: string;
        isMicroHolder: boolean;
        isAdmin: boolean;
        isSuperAdmin: boolean;
    } | null;
    editPoll?: any; // Existing poll to edit
    trigger?: React.ReactNode; // Custom trigger button
    onSuccess?: () => void;
}

const CATEGORIES = [
    { value: "SUGGESTION", label: "💡 Suggestion", color: "text-info" },
    { value: "AMELIORATION", label: "🔧 Amélioration", color: "text-success" },
    { value: "EVENT", label: "🎉 Événement", color: "text-warning" },
    { value: "MISSION", label: "🎯 Mission", color: "text-danger" },
    { value: "AUTRE", label: "📋 Autres", color: "text-violet-400" },
];

const DEFAULT_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

// Plafond de durée d'un sondage : 30 jours max. Les sondages « sans date » (toggle off) sont fermés auto à 30 j (cron close-old-polls).
const MAX_EXPIRY_HOURS = 720;

export function PollCreator({
    guildId,
    discordChannels = [],
    discordRoles = [],
    initialMicroStatus,
    editPoll,
    trigger,
    onSuccess
}: PollCreatorProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    // Steps (modèle DJ/songes : formulaire → configuration Discord)
    const [step, setStep] = useState(1);

    // Micro / Droit de Parole State
    const [microStatus, setMicroStatus] = useState<{ holder: any; isMicroHolder: boolean; isAdmin?: boolean; isSuperAdmin?: boolean } | null>(initialMicroStatus || null);
    const [isAcquiring, setIsAcquiring] = useState(false);

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("SUGGESTION");
    const [options, setOptions] = useState([
        { label: "", emoji: "1️⃣" },
        { label: "", emoji: "2️⃣" },
    ]);
    const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [hasExpiry, setHasExpiry] = useState(false);
    const [expiryHours, setExpiryHours] = useState(24);

    // Discord (salon lecture seule — défini par l'admin, pattern DJ/songes)
    const [publishToDiscord, setPublishToDiscord] = useState(true);
    const [discordSetup, setDiscordSetup] = useState<{ channelId: string | null } | null>(null);
    const [targetChannelName, setTargetChannelName] = useState("annonces");
    const [mentionRoleIds, setMentionRoleIds] = useState<string[]>([]);
    const [discordRolesList, setDiscordRolesList] = useState<{ id: string; name: string; color: string }[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [roleOpen, setRoleOpen] = useState(false);

    const isEdit = !!editPoll;

    const [externalUrl, setExternalUrl] = useState("");

    useEffect(() => {
        if (editPoll) {
            setTitle(editPoll.title);
            setDescription(editPoll.description || "");
            setCategory(editPoll.category);
            setOptions(editPoll.options.map((o: any) => ({ label: o.label, emoji: o.emoji || "" })));
            setAllowMultipleVotes(editPoll.allowMultipleVotes);
            setIsAnonymous(editPoll.isAnonymous);
            setHasExpiry(!!editPoll.expiresAt);
            if (editPoll.expiresAt) {
                const hours = Math.round((new Date(editPoll.expiresAt).getTime() - new Date(editPoll.createdAt).getTime()) / (1000 * 60 * 60));
                setExpiryHours(Math.min(hours > 0 ? hours : 24, MAX_EXPIRY_HOURS));
            }
            setExternalUrl(editPoll.externalUrl || "");
            // Pré-remplir les rôles depuis le CSV stocké
            if (editPoll.mentionRoleId) {
                setMentionRoleIds(String(editPoll.mentionRoleId).split(",").map((id: string) => id.trim()).filter(Boolean));
            }
        }
    }, [editPoll]);

    useEffect(() => {
        if (open) {
            setStep(1);
            refreshMicroStatus();
            const interval = setInterval(refreshMicroStatus, 10000);
            return () => clearInterval(interval);
        }
    }, [open]);

    const refreshMicroStatus = async () => {
        const [microRes, settingsRes] = await Promise.all([
            getMicroStatus(guildId),
            import("@/server/actions/poll-actions").then(m => m.getPollSettings(guildId))
        ]);

        if (microRes.success && microRes.data) {
            setMicroStatus(microRes.data);
        }
        if (settingsRes.success && settingsRes.data) {
            setDiscordSetup({ channelId: settingsRes.data.pollsNotifyChannelId });
            if (settingsRes.data.pollsNotifyChannelId) {
                setPublishToDiscord(true);
                // Résoudre le nom du salon configuré par l'admin (lecture seule)
                getDiscordChannelInfo(guildId, settingsRes.data.pollsNotifyChannelId).then(chanRes => {
                    if (chanRes.success && chanRes.data) {
                        setTargetChannelName(chanRes.data.name ?? "Salon masqué");
                    }
                });
            } else {
                setPublishToDiscord(false);
            }
        }
    };

    const handleAcquireMicroStatus = async () => {
        setIsAcquiring(true);
        try {
            const res = await acquirePollCreatorRole(guildId);
            if (res.success) {
                toast.success("Droit de parole déverrouillé ! Vous avez 1 heure.");
                refreshMicroStatus();
                router.refresh();
            } else {
                toast.error(res.error || "Erreur d'acquisition");
            }
        } finally {
            setIsAcquiring(false);
        }
    };

    const handleReleaseMicro = async () => {
        setIsAcquiring(true);
        try {
            const res = await releasePollCreatorRole(guildId);
            if (res.success) {
                toast.success("Micro relâché !");
                refreshMicroStatus();
                router.refresh();
            } else {
                toast.error(res.error || "Erreur lors de la libération");
            }
        } finally {
            setIsAcquiring(false);
        }
    };

    const addOption = () => {
        if (options.length >= 10) return;
        setOptions([...options, { label: "", emoji: DEFAULT_EMOJIS[options.length] || "🔹" }]);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2) return;
        setOptions(options.filter((_, i) => i !== index));
    };

    const updateOption = (index: number, field: "label" | "emoji", value: string) => {
        const updated = [...options];
        updated[index] = { ...updated[index], [field]: value };
        setOptions(updated);
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setCategory("SUGGESTION");
        setOptions([{ label: "", emoji: "1️⃣" }, { label: "", emoji: "2️⃣" }]);
        setAllowMultipleVotes(false);
        setIsAnonymous(false);
        setHasExpiry(false);
        setExpiryHours(24);
        setPublishToDiscord(!!discordSetup?.channelId);
        setExternalUrl("");
        setMentionRoleIds([]);
        setStep(1);
    };

    // Fetch des rôles whitelistés (identiques pour admins ET membres, fail-closed)
    useEffect(() => {
        if (step === 2 && publishToDiscord && discordRolesList.length === 0) {
            setIsLoadingRoles(true);
            getDiscordRolesAction(guildId, { context: "polls" })
                .then(res => {
                    if (res.success && res.roles) {
                        const filtered = res.roles.filter(r => r.name !== "@everyone") as any;
                        setDiscordRolesList(filtered);
                        // No auto-selection: default = aucun rôle pingé
                        // L'utilisateur doit choisir explicitement
                    }
                })
                .catch(console.error)
                .finally(() => setIsLoadingRoles(false));
        }
    }, [step, publishToDiscord, guildId, isEdit, discordRolesList.length]);



    const executeSubmit = () => {
        const expiresAt = hasExpiry
            ? new Date(Date.now() + Math.min(expiryHours, MAX_EXPIRY_HOURS) * 60 * 60 * 1000).toISOString()
            : null;

        startTransition(async () => {
            const finalPublishToDiscord = isEdit ? false : publishToDiscord;
            const finalMentionRoleIds = mentionRoleIds;

            const pollData = {
                guildId,
                title: title.trim(),
                description: description.trim(),
                category: category as any,
                options: options.filter(o => o.label.trim()).map(o => ({
                    label: o.label.trim(),
                    emoji: o.emoji || undefined,
                })),
                allowMultipleVotes,
                isAnonymous,
                expiresAt,
                publishToDiscord: finalPublishToDiscord,
                discordChannelId: discordSetup?.channelId || undefined,
                mentionEveryone: false,
                mentionRoleIds: finalMentionRoleIds,
                externalUrl: externalUrl.trim() || undefined,
            };

            const res = isEdit
                ? await (import("@/server/actions/poll-actions").then(m => m.updatePoll({ ...pollData, pollId: editPoll.id })))
                : await createPoll(pollData);

            if (res.success) {
                toast.success(isEdit ? "Sondage mis à jour !" : "Sondage créé avec succès !");
                setOpen(false);
                if (!isEdit) resetForm();
                if (onSuccess) onSuccess();
                router.refresh();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const isValid =
        title.trim().length >= 3 &&
        title.trim().length <= 80 &&
        description.trim().length >= 5 &&
        options.filter(o => o.label.trim()).length >= 2;

    return (
        <>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && !isEdit) resetForm(); }}>
                <DialogTrigger asChild>
                    {trigger || (
                        <Button
                            disabled={microStatus?.holder && !microStatus?.isMicroHolder}
                            className={cn(
                                "gap-2 transition-all font-bold uppercase tracking-wider text-caption h-11 px-6 rounded-xl",
                                microStatus?.holder && !microStatus?.isMicroHolder
                                    ? "bg-elevated text-muted-foreground border border-border cursor-not-allowed"
                                    : "bg-info hover:bg-info text-info-foreground shadow-lg shadow-cyan-900/20"
                            )}
                        >
                            {microStatus?.holder && !microStatus?.isMicroHolder ? (
                                <>
                                    <Lock className="w-3.5 h-3.5" />
                                    Micro occupé
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    Nouveau sondage
                                </>
                            )}
                        </Button>
                    )}
                </DialogTrigger>

                <DialogContent className="w-[95vw] max-w-xl bg-background border border-border shadow-2xl rounded-2xl text-foreground max-h-[90vh] overflow-y-auto p-0 gap-0 premium-scrollbar">
                    <div className="p-6 pb-4 border-b border-border bg-surface/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-info/5 blur-3xl rounded-full -mr-16 -mt-16" />
                        <DialogTitle className="text-xl font-black flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 rounded-2xl bg-info/10 border border-info/20 flex items-center justify-center shadow-lg shadow-cyan-900/10">
                                <Sparkles className="w-5 h-5 text-info" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl tracking-tight text-foreground leading-none">
                                    {isEdit ? "Modifier un sondage" : "Lancer un sondage"}
                                </span>
                                <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest mt-1">
                                    Consultation de la guilde
                                </span>
                            </div>
                        </DialogTitle>
                    </div>

                    {/* Content Area */}
                    <div className="p-6">
                        {!microStatus?.isMicroHolder && !microStatus?.isSuperAdmin && (
                            <div className="mb-6 rounded-3xl bg-surface/60 border border-info/10 p-5 space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-info/10 border border-info/20 shrink-0">
                                        <Lock className="w-5 h-5 text-info" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-foreground tracking-tight">Droit de Parole requis</h4>
                                        <p className="text-caption text-muted-foreground leading-relaxed mt-0.5">
                                            {microStatus?.holder
                                                ? <><span className="text-info font-bold">{microStatus.holder.name}</span> a actuellement le micro. Attendez qu'il se libère !</>
                                                : <>Un membre à la fois gère l'attention de la guilde. Prenez le micro pour lancer une consultation.</>}
                                        </p>
                                    </div>
                                </div>

                                {microStatus?.holder && (
                                    <div className="p-4 rounded-2xl bg-surface border border-border space-y-4">
                                        <div className="flex items-center gap-3">
                                            {microStatus.holder.image ? (
                                                <img src={microStatus.holder.image} className="w-10 h-10 rounded-full border border-info/30 p-0.5" alt="" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-elevated border border-info/30 flex items-center justify-center text-info font-bold text-xs">
                                                    {microStatus.holder.name[0]}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-caption font-bold uppercase tracking-tight text-muted-foreground mb-0.5">Occupé par</p>
                                                <p className="text-sm font-bold text-foreground truncate">{microStatus.holder.name}</p>
                                            </div>
                                        </div>
                                        {microStatus.isMicroHolder && (
                                            <Button
                                                onClick={handleReleaseMicro}
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-full rounded-lg bg-surface hover:bg-danger/10 text-muted-foreground hover:text-danger text-caption font-bold uppercase transition-all"
                                            >
                                                Relâcher le micro
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {(!microStatus?.holder || microStatus?.isSuperAdmin) && !microStatus?.isMicroHolder && (
                                    <Button
                                        onClick={handleAcquireMicroStatus}
                                        disabled={isAcquiring || (!!microStatus?.holder && !microStatus?.isSuperAdmin)}
                                        className="w-full h-11 rounded-xl font-bold uppercase tracking-wide text-caption shadow-lg bg-info hover:bg-info text-info-foreground shadow-cyan-900/10 disabled:opacity-50"
                                    >
                                        {microStatus?.holder && !microStatus?.isSuperAdmin ? "Micro occupé" : "Prendre le Micro"}
                                    </Button>
                                )}
                                <p className="text-caption text-center text-muted-foreground font-bold italic uppercase tracking-tight">
                                    Libre après 1h ou publication.
                                </p>
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
                                    {/* Title + Category */}
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="text-caption font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                                    <span>Question de la consultation</span>
                                                    <span className="text-danger font-black">*</span>
                                                </label>
                                                <span className={cn(
                                                    "text-caption font-bold",
                                                    title.length > 70 ? "text-warning" : "text-muted-foreground/60"
                                                )}>
                                                    {title.length}/80
                                                </span>
                                            </div>
                                            <Input
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="Ex: Quelle refonte pour les grades ?"
                                                maxLength={80}
                                                className="h-14 bg-surface/60 border-border text-foreground placeholder:text-muted-foreground text-lg font-bold rounded-xl focus:ring-info/20 focus:border-info/30 transition-all shadow-inner focus:outline-none"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-caption font-bold uppercase tracking-widest text-muted-foreground ml-1">Thématique</label>
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                {CATEGORIES.map((c) => {
                                                    const isSelected = category === c.value;
                                                    return (
                                                        <button
                                                            key={c.value}
                                                            type="button"
                                                            onClick={() => setCategory(c.value)}
                                                            className={cn(
                                                                "relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
                                                                isSelected
                                                                    ? "bg-surface border-border-strong shadow-lg"
                                                                    : "bg-surface border-border hover:bg-surface opacity-60"
                                                            )}
                                                        >
                                                            <span className="text-xl mb-1">{c.label.split(" ")[0]}</span>
                                                            <span className={cn(
                                                                "text-caption font-bold uppercase tracking-tight text-center break-words min-w-0",
                                                                isSelected ? c.color : "text-muted-foreground"
                                                            )}>
                                                                {c.label.split(" ").slice(1).join(" ")}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description — obligatoire */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between ml-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-caption font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                    <span>Description</span>
                                                    <span className="text-danger font-black">*</span>
                                                </p>
                                                <span className="text-[10px] text-danger/80 font-bold uppercase tracking-tight bg-danger/10 px-1.5 py-0.5 rounded border border-danger/20">
                                                    Obligatoire
                                                </span>
                                            </div>
                                            <span className={cn(
                                                "text-caption font-bold",
                                                description.trim().length === 0
                                                    ? "text-muted-foreground/60"
                                                    : description.trim().length < 5
                                                    ? "text-warning"
                                                    : "text-muted-foreground/60"
                                            )}>
                                                {description.length}/500 {description.trim().length > 0 && description.trim().length < 5 && "(min. 5 car.)"}
                                            </span>
                                        </div>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={3}
                                            placeholder="Contextualisez votre question, expliquez les choix et les enjeux... (sera affiché sur Discord et dans le dashboard)"
                                            maxLength={500}
                                            className={cn(
                                                "w-full bg-surface/60 hover:bg-surface/80 border rounded-2xl px-5 py-4 text-sm text-foreground focus:outline-none transition-all resize-none placeholder:text-muted-foreground",
                                                description.trim().length > 0 && description.trim().length < 5
                                                    ? "border-warning/50 focus:border-warning focus:ring-2 focus:ring-warning/10"
                                                    : "border-border focus:border-info/50 focus:ring-2 focus:ring-info/10"
                                            )}
                                        />
                                        {/* Aperçu Discord temps réel */}
                                        {description.trim() && (
                                            <div className="rounded-xl border border-[#5865F2]/20 bg-[#2b2d31]/80 p-4 space-y-2">
                                                <p className="text-caption font-black text-[#5865F2] uppercase tracking-widest flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#5865F2] inline-block" />
                                                    Aperçu Discord
                                                </p>
                                                <div className="border-l-4 border-[#5865F2] pl-3">
                                                    <p className="text-sm font-bold text-white/90 truncate">{title || "Titre du sondage..."}</p>
                                                    <p className="text-xs text-white/60 mt-1 whitespace-pre-wrap leading-relaxed">{description}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Options */}
                                    <div className="space-y-4">
                                        <label className="text-caption font-bold uppercase tracking-widest text-muted-foreground ml-1">Options ({options.length}/10)</label>
                                        <div className="space-y-3">
                                            <AnimatePresence mode="popLayout">
                                                {options.map((opt, i) => (
                                                    <motion.div
                                                        key={i}
                                                        layout
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        className="flex items-center gap-2 p-1.5 rounded-xl bg-surface/30 border border-border focus-within:border-info/30 transition-all font-bold min-w-0"
                                                    >
                                                        <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                                                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                        <input
                                                            value={opt.emoji}
                                                            onChange={(e) => updateOption(i, "emoji", e.target.value)}
                                                            className="w-10 h-10 bg-transparent border-none text-center text-xl focus:ring-0 outline-none text-foreground shrink-0"
                                                        />
                                                        <Input
                                                            value={opt.label}
                                                            onChange={(e) => updateOption(i, "label", e.target.value)}
                                                            placeholder={`Option ${i + 1}`}
                                                            maxLength={100}
                                                            className="flex-1 min-w-0 bg-transparent border-none text-foreground placeholder:text-foreground h-10 font-bold text-md focus-visible:ring-0"
                                                        />
                                                        {options.length > 2 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeOption(i)}
                                                                className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            <button
                                                type="button"
                                                onClick={addOption}
                                                disabled={options.length >= 10}
                                                className={cn(
                                                    "flex items-center gap-2 w-full justify-center py-4 rounded-xl border border-dashed transition-all",
                                                    options.length >= 10
                                                        ? "border-border opacity-20"
                                                        : "border-border text-muted-foreground hover:text-info hover:border-info/30 bg-surface"
                                                )}
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span className="text-caption font-bold uppercase tracking-widest">
                                                    {options.length >= 10 ? "Maximum 10 options" : "Ajouter un choix"}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Settings Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-info/10">
                                                        <Users className="w-4 h-4 text-info" />
                                                    </div>
                                                    <div>
                                                        <p className="text-caption font-bold text-foreground uppercase tracking-tight">Votes multiples</p>
                                                        <p className="text-caption text-muted-foreground font-medium tracking-tight">Plusieurs choix possibles</p>
                                                    </div>
                                                </div>
                                                <Switch checked={allowMultipleVotes} onCheckedChange={setAllowMultipleVotes} className="scale-90" />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-warning/10">
                                                        <Clock className="w-4 h-4 text-warning" />
                                                    </div>
                                                    <div>
                                                        <p className="text-caption font-bold text-foreground uppercase tracking-tight">Expiration</p>
                                                        <p className="text-caption text-muted-foreground font-medium tracking-tight">Fin automatique</p>
                                                    </div>
                                                </div>
                                                <Switch checked={hasExpiry} onCheckedChange={setHasExpiry} className="scale-90" />
                                            </div>

                                            <AnimatePresence mode="wait">
                                                {hasExpiry && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="grid grid-cols-4 gap-2 p-1 rounded-xl bg-surface/80 border border-border mt-3">
                                                            {[
                                                                { value: 24, label: "24h", emoji: "⏳" },
                                                                { value: 48, label: "48h", emoji: "⌛" },
                                                                { value: 168, label: "7j", emoji: "📅" },
                                                                { value: 720, label: "30j", emoji: "📆" }
                                                            ].map((opt) => (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => setExpiryHours(opt.value)}
                                                                    className={cn(
                                                                        "relative py-3 rounded-lg text-caption font-bold uppercase tracking-widest transition-all",
                                                                        expiryHours === opt.value
                                                                            ? "text-info"
                                                                            : "text-muted-foreground hover:text-muted-foreground hover:bg-surface"
                                                                    )}
                                                                >
                                                                    {expiryHours === opt.value && (
                                                                        <motion.div
                                                                            layoutId="expiry-bg"
                                                                            className="absolute inset-0 bg-info/10 border border-info/20 rounded-lg"
                                                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                                        />
                                                                    )}
                                                                    <span className="relative z-10 flex flex-col items-center gap-1">
                                                                        <span className="text-sm opacity-80">{opt.emoji}</span>
                                                                        <span>{opt.label}</span>
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                            {!hasExpiry && (
                                                <p className="text-caption text-muted-foreground mt-2">
                                                    Sans date : le sondage sera fermé automatiquement après 30 jours.
                                                </p>
                                            )}
                                        </div>

                                        <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 rounded-xl bg-info/10">
                                                    <Info className="w-4 h-4 text-info" />
                                                </div>
                                                <div>
                                                    <p className="text-caption font-bold text-foreground uppercase tracking-tight">Lien externe (Optionnel)</p>
                                                    <p className="text-caption text-muted-foreground font-medium tracking-tight">URL associée au sondage</p>
                                                </div>
                                            </div>
                                            <Input
                                                type="url"
                                                placeholder="https://..."
                                                value={externalUrl}
                                                onChange={(e) => setExternalUrl(e.target.value)}
                                                className="bg-background/40 border-border focus:border-info/30 text-foreground rounded-xl text-xs h-10 focus:outline-none"
                                            />
                                        </div>
                                    </div>


                                    {/* Footer - Details Step */}
                                    <div className="pt-8 border-t border-border mt-4">
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                                            <Button
                                                variant="ghost"
                                                onClick={() => setOpen(false)}
                                                className="h-12 px-8 rounded-xl text-caption font-black text-muted-foreground hover:text-foreground transition-all uppercase tracking-[0.2em] border border-border hover:bg-surface order-2 sm:order-1"
                                            >
                                                Annuler
                                            </Button>
                                            <Button
                                                className="flex-1 h-12 px-10 rounded-xl font-black text-caption tracking-[0.2em] transition-all active:scale-95 shadow-xl relative group overflow-hidden order-1 sm:order-2 bg-info hover:bg-info text-info-foreground shadow-cyan-900/20"
                                                onClick={() => setStep(2)}
                                                disabled={!isValid}
                                            >
                                                <div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-10 transition-opacity" />
                                                <div className="flex items-center justify-center gap-3 relative z-10 uppercase">
                                                    <ChevronRight className="w-4 h-4" />
                                                    SUIVANT
                                                </div>
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                    <div className="text-center space-y-3 mb-8">
                                        <div className="w-16 h-16 rounded-3xl bg-info/10 border border-info/20 flex items-center justify-center mx-auto ">
                                            <Hash className="w-8 h-8 text-info" />
                                        </div>
                                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Configuration Discord</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">Voulez-vous notifier la guilde de ce sondage sur Discord ?</p>
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
                                                checked={publishToDiscord && !!discordSetup?.channelId}
                                                onCheckedChange={setPublishToDiscord}
                                                disabled={!discordSetup?.channelId}
                                                className="data-[state=checked]:bg-info scale-125 origin-right"
                                            />
                                        </div>

                                        {!discordSetup?.channelId && (
                                            <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-3">
                                                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                                                <p className="text-caption text-warning/70 font-bold uppercase tracking-wider">
                                                    Discord non configuré pour ce module. Contactez un admin.
                                                </p>
                                            </div>
                                        )}

                                        {publishToDiscord && discordRolesList.length > 0 && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-8 pt-6 border-t border-info/20 space-y-3">
                                                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-warning/8 border border-warning/20">
                                                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                                                    <p className="text-caption text-warning/80 font-medium leading-relaxed">
                                                        <span className="font-bold text-warning">Aucun ping par défaut.</span> Sans sélection, personne ne sera notifié. Choisissez un ou plusieurs rôles pour donner de la visibilité à votre sondage.
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
                                                                            const role = discordRolesList.find(r => r.id === id);
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
                                                                    {discordRolesList.map((role) => (
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
                                                className="flex-1 h-12 px-10 rounded-xl font-black text-caption tracking-[0.2em] transition-all active:scale-95 shadow-xl relative group overflow-hidden order-1 sm:order-2 bg-info hover:bg-info text-info-foreground shadow-cyan-900/20"
                                                onClick={() => executeSubmit()}
                                                disabled={isPending}
                                            >
                                                <div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-10 transition-opacity" />
                                                <div className="flex items-center justify-center gap-3 relative z-10 uppercase">
                                                    {isPending ? (
                                                        <div className="w-4 h-4 border-2 border-border/20 border-t-zinc-950 rounded-full animate-spin" />
                                                    ) : (
                                                        <Check className="w-4 h-4" />
                                                    )}
                                                    {isPending ? "PUBLICATION..." : "CONFIRMER & PUBLIER"}
                                                </div>
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}