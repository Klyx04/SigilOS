"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Plus,
    Sparkles,
    Send,
    Clock,
    Users,
    Lock,
    Megaphone,
    Hash,
    Trash2,
    GripVertical,
    Check,
    AtSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createPoll, acquirePollCreatorRole, getMicroStatus, releasePollCreatorRole } from "@/server/actions/poll-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PollCreatorProps {
    guildId: string;
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
    { value: "SUGGESTION", label: "💡 Suggestion", color: "text-cyan-400" },
    { value: "AMELIORATION", label: "🔧 Amélioration", color: "text-emerald-400" },
    { value: "EVENT", label: "🎉 Événement", color: "text-amber-400" },
    { value: "MISSION", label: "🎯 Mission", color: "text-red-400" },
    { value: "AUTRE", label: "📋 Autres", color: "text-violet-400" },
];

const DEFAULT_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

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

    // Discord
    const [publishToDiscord, setPublishToDiscord] = useState(true);
    const [channelId, setChannelId] = useState("none");
    const [mentionEveryone, setMentionEveryone] = useState(false);
    const [discordSetup, setDiscordSetup] = useState<{ channelId: string | null } | null>(null);

    const isEdit = !!editPoll;

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
                // Approximate hours for the UI
                const hours = Math.round((new Date(editPoll.expiresAt).getTime() - new Date(editPoll.createdAt).getTime()) / (1000 * 60 * 60));
                setExpiryHours(hours > 0 ? hours : 24);
            }
        }
    }, [editPoll]);

    useEffect(() => {
        if (open) {
            refreshMicroStatus();
            const interval = setInterval(refreshMicroStatus, 10000); // 10s interval when open
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
            // Auto-disable if not setup
            if (!settingsRes.data.pollsNotifyChannelId) {
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
        setIsAcquiring(true); // Reusing isAcquiring for the loading state
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
        setPublishToDiscord(true);
        setChannelId("none");
        setMentionEveryone(false);
    };

    const handleSubmit = () => {
        if (!title.trim()) return toast.error("Le titre est obligatoire");
        if (options.filter(o => o.label.trim()).length < 2) return toast.error("Minimum 2 options requises");

        const expiresAt = hasExpiry
            ? new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
            : null;

        startTransition(async () => {
            const pollData = {
                guildId,
                title: title.trim(),
                description: description.trim() || undefined,
                category: category as any,
                options: options.filter(o => o.label.trim()).map(o => ({
                    label: o.label.trim(),
                    emoji: o.emoji || undefined,
                })),
                allowMultipleVotes,
                isAnonymous,
                expiresAt,
                publishToDiscord: isEdit ? false : publishToDiscord, // Don't re-publish to discord on edit for now
                discordChannelId: channelId === "none" ? undefined : channelId,
                mentionEveryone,
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

    const isValid = title.trim().length >= 3 && options.filter(o => o.label.trim()).length >= 2;

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && !isEdit) resetForm(); }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        disabled={microStatus?.holder && !microStatus?.isMicroHolder}
                        className={cn(
                            "gap-2 transition-all font-black uppercase tracking-widest text-xs h-12 px-6 rounded-xl",
                            microStatus?.holder && !microStatus?.isMicroHolder
                                ? "bg-zinc-800 text-zinc-600 border border-white/5 cursor-not-allowed grayscale"
                                : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 hover:border-cyan-500/50 shadow-lg shadow-cyan-500/5"
                        )}
                    >
                        {microStatus?.holder && !microStatus?.isMicroHolder ? (
                            <>
                                <Lock className="w-4 h-4" />
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

            <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[95vh] bg-zinc-950 border-white/10 p-0 overflow-y-auto flex flex-col sm:flex-row shadow-2xl scrollbar-thin scrollbar-thumb-white/10">
                {/* Side Explanation (Micro Logic) */}
                <div className="w-full sm:w-[320px] bg-zinc-900/50 border-r border-white/5 p-8 flex flex-col gap-8 shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full -mr-16 -mt-16" />

                    <div className="space-y-6 relative z-10">
                        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 w-fit shadow-xl shadow-cyan-500/10">
                            <Lock className="w-6 h-6 text-cyan-400" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white italic leading-tight">Droit de Parole</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                            Le <span className="text-cyan-400 font-bold">Droit de Parole</span> est une exclusivité temporaire d'une heure pour créer un sondage.
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                            Un seul membre à la fois gère l'attention de la guilde, évitant ainsi la saturation des notifications.
                        </p>
                        <ul className="text-[10px] space-y-3 text-zinc-500 font-bold uppercase tracking-wider">
                            <li className="flex gap-2 items-center">
                                <Check className="w-4 h-4 text-cyan-500 shrink-0" />
                                1 sondage / cat / sem
                            </li>
                            <li className="flex gap-2 items-center">
                                <Check className="w-4 h-4 text-cyan-500 shrink-0" />
                                Discord Interactif
                            </li>
                            <li className="flex gap-2 items-center">
                                <Check className="w-4 h-4 text-cyan-500 shrink-0" />
                                Durée max 1 sem
                            </li>
                        </ul>
                    </div>

                    <div className="mt-auto space-y-4 relative z-10">
                        {microStatus?.holder && (
                            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        {microStatus.holder.image ? (
                                            <img src={microStatus.holder.image} className="w-12 h-12 rounded-full border-2 border-cyan-500/50 p-0.5" alt="" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-cyan-500/50 flex items-center justify-center text-cyan-400 font-black">
                                                {microStatus.holder.name[0]}
                                            </div>
                                        )}
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 border-4 border-zinc-900 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Occupé par</p>
                                        <p className="text-sm font-black text-white truncate italic">{microStatus.holder.name}</p>
                                    </div>
                                </div>
                                {microStatus.isMicroHolder && (
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-tighter border border-cyan-500/30">
                                            <Clock className="w-3.5 h-3.5" />
                                            Vous avez le micro
                                        </div>
                                        <Button
                                            onClick={handleReleaseMicro}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase border border-red-500/20 transition-all"
                                        >
                                            Relâcher
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {(!microStatus?.holder || microStatus?.isSuperAdmin) && !microStatus?.isMicroHolder && (
                            <Button
                                onClick={handleAcquireMicroStatus}
                                disabled={isAcquiring}
                                className={cn(
                                    "w-full h-14 rounded-2xl font-black uppercase tracking-wider text-xs shadow-2xl transition-all border-b-4 active:border-b-0 active:translate-y-1",
                                    microStatus?.holder
                                        ? "bg-amber-500 hover:bg-amber-400 border-amber-700 shadow-amber-500/30"
                                        : "bg-cyan-500 hover:bg-cyan-400 border-cyan-700 shadow-cyan-500/30"
                                )}
                            >
                                {isAcquiring ? "Attente..." : microStatus?.holder ? "Reprendre le Micro" : "Prendre le Micro"}
                            </Button>
                        )}
                        <p className="text-[10px] text-center text-zinc-600 font-bold italic uppercase tracking-tight">
                            Libre après 1h ou publication.
                        </p>
                    </div>
                </div>

                {/* Main Form */}
                <div className="flex-1 min-w-0 p-6 sm:p-10 relative">
                    {!microStatus?.isMicroHolder && !microStatus?.isSuperAdmin && (
                        <div className="absolute inset-0 z-50 bg-zinc-950/40 backdrop-blur-[4px] flex items-center justify-center p-8 text-center">
                            <div className="max-w-xs space-y-6">
                                <div className="p-8 rounded-3xl bg-zinc-900 border border-white/10 shadow-3xl space-y-6">
                                    <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto shadow-inner shadow-white/5">
                                        <Lock className="w-10 h-10 text-cyan-400" />
                                    </div>
                                    <h4 className="text-2xl font-black uppercase italic tracking-tighter">Accès Verrouillé</h4>
                                    <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                        {microStatus?.holder
                                            ? <><span className="text-cyan-400 font-bold">{microStatus.holder.name}</span> a actuellement le micro. Attendez qu'il se libère !</>
                                            : <>Vous devez prendre le <span className="text-cyan-400 font-bold italic underline underline-offset-4 decoration-cyan-500/30">Micro</span> pour lancer une consultation.</>
                                        }
                                    </p>
                                    <Button
                                        onClick={handleAcquireMicroStatus}
                                        disabled={isAcquiring || (!!microStatus?.holder && !microStatus?.isSuperAdmin)}
                                        className="w-full h-14 bg-cyan-500 hover:bg-cyan-400 text-white font-black uppercase rounded-2xl shadow-xl shadow-cyan-500/20 disabled:opacity-50"
                                    >
                                        {microStatus?.holder && !microStatus?.isSuperAdmin ? "Micro occupé" : "Prendre le Micro"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogHeader className="mb-10">
                        <DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tighter italic text-white">
                            <Sparkles className="w-8 h-8 text-cyan-400" />
                            {isEdit ? "Modification" : "Configuration"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-10">
                        {/* Title + Category */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-3 block">Titre de la consultation</label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Refonte du système de grades ?"
                                    maxLength={200}
                                    className="h-16 bg-white/5 border-white/10 text-white placeholder:text-zinc-700 text-xl font-black rounded-2xl focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all shadow-inner"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 block">Thématique de la consultation</label>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {CATEGORIES.map((c) => {
                                        const isSelected = category === c.value;
                                        return (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() => setCategory(c.value)}
                                                className={cn(
                                                    "relative group flex flex-col items-center justify-center gap-3 p-4 rounded-3xl border transition-all duration-300",
                                                    isSelected
                                                        ? "bg-white/10 border-white/20 shadow-xl scale-[1.02]"
                                                        : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10 opacity-60 hover:opacity-100"
                                                )}
                                            >
                                                {isSelected && (
                                                    <motion.div
                                                        layoutId="cat-glow"
                                                        className="absolute inset-0 rounded-3xl bg-cyan-500/10 blur-xl px-4"
                                                        transition={{ duration: 0.5 }}
                                                    />
                                                )}
                                                <span className="text-3xl relative z-10 transition-transform group-hover:scale-125 duration-300">
                                                    {c.label.split(" ")[0]}
                                                </span>
                                                <span className={cn(
                                                    "text-[11px] font-black uppercase tracking-widest relative z-10 text-center",
                                                    isSelected ? c.color : "text-zinc-500"
                                                )}>
                                                    {c.label.split(" ").slice(1).join(" ")}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Choix proposés ({options.length}/10)</label>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest italic",
                                    options.length >= 10 ? "text-amber-500" : "text-zinc-700"
                                )}>
                                    {options.length >= 10 ? "Limite atteinte" : "Interactivité maximum"}
                                </span>
                            </div>
                            <div className="space-y-4">
                                <AnimatePresence mode="popLayout">
                                    {options.map((opt, i) => (
                                        <motion.div
                                            key={i}
                                            layout
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="flex items-center gap-4 p-2 rounded-2xl bg-white/[0.02] border border-white/5 focus-within:border-cyan-500/40 focus-within:bg-white/[0.04] transition-all shadow-lg"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
                                                <GripVertical className="w-5 h-5 text-zinc-700" />
                                            </div>
                                            <input
                                                value={opt.emoji}
                                                onChange={(e) => updateOption(i, "emoji", e.target.value)}
                                                className="w-14 h-12 bg-transparent border-none text-center text-2xl focus:ring-0 outline-none font-bold"
                                            />
                                            <Input
                                                value={opt.label}
                                                onChange={(e) => updateOption(i, "label", e.target.value)}
                                                placeholder={`Option ${i + 1}`}
                                                maxLength={200}
                                                className="flex-1 bg-transparent border-none text-white placeholder:text-zinc-800 h-12 italic font-black text-lg focus-visible:ring-0"
                                            />
                                            {options.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeOption(i)}
                                                    className="w-12 h-12 flex items-center justify-center rounded-xl text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all mr-1"
                                                >
                                                    <Trash2 className="w-5 h-5" />
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
                                        "flex items-center gap-3 w-full justify-center py-6 rounded-3xl border-2 border-dashed transition-all group",
                                        options.length >= 10
                                            ? "border-white/5 opacity-20 cursor-not-allowed"
                                            : "border-white/5 text-zinc-600 hover:text-cyan-400 hover:border-cyan-500/30 bg-white/[0.01]"
                                    )}
                                >
                                    <div className="p-2 rounded-xl bg-zinc-900 group-hover:bg-cyan-500/10 transition-colors shadow-inner">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-[0.2em] italic">
                                        {options.length >= 10 ? "Maximum 10 options" : "Ajouter une variante"}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Advanced Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 space-y-6 shadow-2xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-purple-500/10 shadow-lg shadow-purple-500/5">
                                            <Users className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-tight">Votes multiples</p>
                                            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Autoriser plusieurs choix</p>
                                        </div>
                                    </div>
                                    <Switch checked={allowMultipleVotes} onCheckedChange={setAllowMultipleVotes} />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-2xl bg-amber-500/10 shadow-lg shadow-amber-500/5">
                                                <Clock className="w-5 h-5 text-amber-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white uppercase tracking-tight">Expiration</p>
                                                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Clôture automatique</p>
                                            </div>
                                        </div>
                                        <Switch checked={hasExpiry} onCheckedChange={setHasExpiry} />
                                    </div>

                                    <AnimatePresence mode="wait">
                                        {hasExpiry && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-zinc-900/80 border border-white/5 mt-3">
                                                    {[
                                                        { value: 24, label: "24h", emoji: "⏳" },
                                                        { value: 48, label: "48h", emoji: "⌛" },
                                                        { value: 168, label: "7j", emoji: "📅" }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => setExpiryHours(opt.value)}
                                                            className={cn(
                                                                "relative py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                                expiryHours === opt.value
                                                                    ? "text-cyan-400"
                                                                    : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
                                                            )}
                                                        >
                                                            {expiryHours === opt.value && (
                                                                <motion.div
                                                                    layoutId="expiry-bg"
                                                                    className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-lg"
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
                                </div>
                            </div>

                            <div className="p-8 rounded-[40px] bg-[#5865F2]/5 border border-[#5865F2]/20 space-y-6 shadow-2xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-[#5865F2]/20 shadow-lg shadow-[#5865F2]/10">
                                            <Megaphone className="w-5 h-5 text-[#5865F2]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-tight">Annonce Discord</p>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider italic">Embed interactif premium</p>
                                        </div>
                                    </div>
                                    <Switch
                                        disabled={!discordSetup?.channelId}
                                        checked={publishToDiscord}
                                        onCheckedChange={setPublishToDiscord}
                                    />
                                </div>
                                {!discordSetup?.channelId && (
                                    <p className="text-[9px] text-amber-500/80 font-bold uppercase tracking-tight italic mt-[-10px] px-2 leading-tight">
                                        ⚠️ Salon Discord non configuré par l'admin. Publication impossible.
                                    </p>
                                )}

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-zinc-800 shadow-inner">
                                            <AtSign className="w-5 h-5 text-zinc-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-tight">Mention @everyone</p>
                                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Alerte communautaire</p>
                                        </div>
                                    </div>
                                    <Switch disabled={!publishToDiscord} checked={mentionEveryone} onCheckedChange={setMentionEveryone} />
                                </div>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="pt-12 border-t border-white/5 relative mt-8">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-2 bg-zinc-950 border border-white/5 rounded-full text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600 italic whitespace-nowrap">
                                Validation de la consultation
                            </div>

                            <Button
                                onClick={handleSubmit}
                                disabled={isPending || !isValid || !microStatus?.isMicroHolder}
                                className={cn(
                                    "w-full h-14 gap-3 text-sm font-black uppercase tracking-[0.2em] transition-all",
                                    "bg-gradient-to-br from-cyan-600 via-cyan-500 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300",
                                    "text-white shadow-[0_15px_40px_-12px_rgba(6,182,212,0.4)] rounded-2xl",
                                    "disabled:opacity-20 disabled:grayscale translate-y-0 active:translate-y-1 active:shadow-none border-b-4 border-cyan-800/50 active:border-b-0"
                                )}
                            >
                                {isPending ? (
                                    <>
                                        <Clock className="w-4 h-4 animate-spin" />
                                        Synchronisation...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5 -rotate-12 group-hover:rotate-0 transition-transform" />
                                        {isEdit ? "Mettre à jour" : "Propulser le sondage"}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
