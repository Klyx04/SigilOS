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
    Trash2,
    GripVertical,
    AtSign,
    Info,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

    const [externalUrl, setExternalUrl] = useState("");
    const [showDiscordConfirm, setShowDiscordConfirm] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState("");
    const [mentionType, setMentionType] = useState<"none" | "everyone" | "here" | "role">("none");
    const [selectedRoleId, setSelectedRoleId] = useState("");
    const [pollsPingRoleIds, setPollsPingRoleIds] = useState<string[]>([]);

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
                setExpiryHours(hours > 0 ? hours : 24);
            }
            setExternalUrl(editPoll.externalUrl || "");
        }
    }, [editPoll]);

    useEffect(() => {
        if (open) {
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
            setPollsPingRoleIds(settingsRes.data.pollsPingRoleIds || []);
            if (settingsRes.data.pollsNotifyChannelId) {
                setSelectedChannelId(settingsRes.data.pollsNotifyChannelId);
            }
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
        setPublishToDiscord(true);
        setChannelId("none");
        setMentionEveryone(false);
        setExternalUrl("");
        setMentionType("none");
        setSelectedRoleId("");
    };

    const handleSubmit = () => {
        if (!title.trim()) return toast.error("Le titre est obligatoire");
        if (options.filter(o => o.label.trim()).length < 2) return toast.error("Minimum 2 options requises");

        // Validate URL format if provided
        if (externalUrl.trim()) {
            try {
                new URL(externalUrl.trim());
            } catch (_) {
                return toast.error("L'URL externe n'est pas valide (elle doit commencer par http:// ou https://)");
            }
        }

        if (publishToDiscord && !isEdit) {
            setShowDiscordConfirm(true);
        } else {
            executeSubmit();
        }
    };

    const executeSubmit = (discordConfigOverride?: { channelId?: string; mentionEveryone?: boolean; mentionRoleId?: string }) => {
        const expiresAt = hasExpiry
            ? new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
            : null;

        startTransition(async () => {
            const finalPublishToDiscord = isEdit ? false : publishToDiscord;
            const finalChannelId = discordConfigOverride?.channelId !== undefined
                ? discordConfigOverride.channelId
                : (channelId === "none" ? undefined : channelId);
            const finalMentionEveryone = discordConfigOverride?.mentionEveryone !== undefined
                ? discordConfigOverride.mentionEveryone
                : mentionEveryone;
            const finalMentionRoleId = discordConfigOverride?.mentionRoleId !== undefined
                ? discordConfigOverride.mentionRoleId
                : undefined;

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
                publishToDiscord: finalPublishToDiscord,
                discordChannelId: finalChannelId,
                mentionEveryone: finalMentionEveryone,
                mentionRoleId: finalMentionRoleId,
                externalUrl: externalUrl.trim() || undefined,
            };

            const res = isEdit
                ? await (import("@/server/actions/poll-actions").then(m => m.updatePoll({ ...pollData, pollId: editPoll.id })))
                : await createPoll(pollData);

            if (res.success) {
                toast.success(isEdit ? "Sondage mis à jour !" : "Sondage créé avec succès !");
                setOpen(false);
                setShowDiscordConfirm(false);
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
        <>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && !isEdit) resetForm(); }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        disabled={microStatus?.holder && !microStatus?.isMicroHolder}
                        className={cn(
                            "gap-2 transition-all font-bold uppercase tracking-wider text-[10px] h-11 px-6 rounded-xl",
                            microStatus?.holder && !microStatus?.isMicroHolder
                                ? "bg-zinc-800 text-zinc-600 border border-white/5 cursor-not-allowed"
                                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20"
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

            <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[95vh] bg-zinc-950 border-white/10 p-0 overflow-y-auto flex flex-col sm:flex-row shadow-2xl scrollbar-thin scrollbar-thumb-white/10">
                {/* Side Explanation (Micro Logic) */}
                <div className="w-full sm:w-[320px] bg-zinc-900/50 border-r border-white/5 p-8 flex flex-col gap-8 shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full -mr-16 -mt-16" />

                    <div className="space-y-4 relative z-10">
                        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 w-fit">
                            <Lock className="w-5 h-5 text-cyan-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight leading-tight">Droit de Parole</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Le <span className="text-cyan-400 font-bold">Droit de Parole</span> est une exclusivité d&apos;une heure pour créer un sondage.
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Un membre à la fois gère l&apos;attention de la guilde pour éviter la saturation.
                        </p>
                    </div>

                    <div className="mt-auto space-y-4 relative z-10">
                        {microStatus?.holder && (
                            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        {microStatus.holder.image ? (
                                            <img src={microStatus.holder.image} className="w-10 h-10 rounded-full border border-cyan-500/30 p-0.5" alt="" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                                                {microStatus.holder.name[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-bold uppercase tracking-tight text-zinc-500 mb-0.5">Occupé par</p>
                                        <p className="text-sm font-bold text-white truncate">{microStatus.holder.name}</p>
                                    </div>
                                </div>
                                {microStatus.isMicroHolder && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-tight border border-cyan-500/20">
                                            <Clock className="w-3.5 h-3.5" />
                                            Vous avez le micro
                                        </div>
                                        <Button
                                            onClick={handleReleaseMicro}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-full rounded-lg bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 text-[10px] font-bold uppercase transition-all"
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
                                    "w-full h-12 rounded-xl font-bold uppercase tracking-wide text-[10px] shadow-lg transition-all",
                                    "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/10"
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
                                <div className="p-8 rounded-2xl bg-zinc-900 border border-white/5 shadow-2xl space-y-6">
                                    <div className="w-16 h-16 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto">
                                        <Lock className="w-8 h-8 text-cyan-400" />
                                    </div>
                                    <h4 className="text-xl font-bold text-white tracking-tight px-4">Accès Restreint</h4>
                                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                                        {microStatus?.holder
                                            ? <><span className="text-cyan-400 font-bold">{microStatus.holder.name}</span> a actuellement le micro. Attendez qu&apos;il se libère !</>
                                            : <>Vous devez posséder le <span className="text-cyan-400 font-bold decoration-cyan-500/30">Droit de Parole</span> pour lancer une consultation.</>
                                        }
                                    </p>
                                    <Button
                                        onClick={handleAcquireMicroStatus}
                                        disabled={isAcquiring || (!!microStatus?.holder && !microStatus?.isSuperAdmin)}
                                        className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase rounded-xl shadow-lg shadow-cyan-900/20 disabled:opacity-50 text-[10px]"
                                    >
                                        {microStatus?.holder && !microStatus?.isSuperAdmin ? "Micro occupé" : "Prendre le Micro"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogHeader className="mb-8">
                        <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white tracking-tight">
                            <Sparkles className="w-6 h-6 text-cyan-400" />
                            {isEdit ? "Modifier le sondage" : "Lancer un sondage"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-10">
                        {/* Title + Category */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Question de la consultation</label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Quelle refonte pour les grades ?"
                                    maxLength={200}
                                    className="h-14 bg-white/5 border-white/5 text-white placeholder:text-zinc-700 text-lg font-bold rounded-xl focus:ring-cyan-500/20 focus:border-cyan-500/30 transition-all shadow-inner"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Thématique</label>
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
                                                        ? "bg-white/10 border-white/20 shadow-lg"
                                                        : "bg-white/[0.02] border-white/5 hover:bg-white/5 opacity-60"
                                                )}
                                            >
                                                <span className="text-xl mb-1">{c.label.split(" ")[0]}</span>
                                                <span className={cn(
                                                    "text-[9px] font-bold uppercase tracking-tight text-center",
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
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Options ({options.length}/10)</label>
                            <div className="space-y-3">
                                <AnimatePresence mode="popLayout">
                                    {options.map((opt, i) => (
                                        <motion.div
                                            key={i}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="flex items-center gap-2 p-1.5 rounded-xl bg-white/[0.02] border border-white/5 focus-within:border-cyan-500/30 transition-all font-bold"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0">
                                                <GripVertical className="w-4 h-4 text-zinc-700" />
                                            </div>
                                            <input
                                                value={opt.emoji}
                                                onChange={(e) => updateOption(i, "emoji", e.target.value)}
                                                className="w-10 h-10 bg-transparent border-none text-center text-xl focus:ring-0 outline-none"
                                            />
                                            <Input
                                                value={opt.label}
                                                onChange={(e) => updateOption(i, "label", e.target.value)}
                                                placeholder={`Option ${i + 1}`}
                                                maxLength={100}
                                                className="flex-1 bg-transparent border-none text-white placeholder:text-zinc-800 h-10 font-bold text-md focus-visible:ring-0"
                                            />
                                            {options.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeOption(i)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
                                            ? "border-white/5 opacity-20"
                                            : "border-white/10 text-zinc-500 hover:text-cyan-400 hover:border-cyan-500/30 bg-white/[0.01]"
                                    )}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">
                                        {options.length >= 10 ? "Maximum 10 options" : "Ajouter un choix"}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-purple-500/10">
                                            <Users className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-white uppercase tracking-tight">Votes multiples</p>
                                            <p className="text-[9px] text-zinc-500 font-medium tracking-tight">Plusieurs choix possibles</p>
                                        </div>
                                    </div>
                                    <Switch checked={allowMultipleVotes} onCheckedChange={setAllowMultipleVotes} className="scale-90" />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-amber-500/10">
                                                <Clock className="w-4 h-4 text-amber-400" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-white uppercase tracking-tight">Expiration</p>
                                                <p className="text-[9px] text-zinc-500 font-medium tracking-tight">Fin automatique</p>
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
                                                                "relative py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
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

                                <div className="space-y-2 pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-cyan-500/10">
                                            <Info className="w-4 h-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-white uppercase tracking-tight">Lien externe (Optionnel)</p>
                                            <p className="text-[9px] text-zinc-500 font-medium tracking-tight">URL associée au sondage</p>
                                        </div>
                                    </div>
                                    <Input
                                        type="url"
                                        placeholder="https://..."
                                        value={externalUrl}
                                        onChange={(e) => setExternalUrl(e.target.value)}
                                        className="bg-zinc-950/40 border-white/10 focus:border-cyan-500/30 text-white rounded-xl text-xs h-10"
                                    />
                                </div>
                            </div>

                            <div className="p-6 rounded-2xl bg-[#5865F2]/5 border border-[#5865F2]/10 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-[#5865F2]/20">
                                            <Megaphone className="w-4 h-4 text-[#5865F2]" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-white uppercase tracking-tight">Annonce Discord</p>
                                            <p className="text-[9px] text-zinc-500 font-medium tracking-tight">Alerte interactive</p>
                                        </div>
                                    </div>
                                    <Switch
                                        disabled={!discordSetup?.channelId}
                                        checked={publishToDiscord}
                                        onCheckedChange={setPublishToDiscord}
                                        className="scale-90"
                                    />
                                </div>

                                {!discordSetup?.channelId && (
                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-[#5865F2]/5 border border-[#5865F2]/10 animate-in fade-in slide-in-from-top-2">
                                        <Info className="w-4 h-4 text-[#5865F2]/80 shrink-0 mt-0.5" />
                                        <p className="text-[10px] font-bold text-[#5865F2]/80 uppercase tracking-tight leading-relaxed">
                                            Le salon Discord n&apos;est pas configuré. Activez-le dans l&apos;admin pour publier vos sondages.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-8 border-t border-white/5">
                            <Button
                                onClick={handleSubmit}
                                disabled={isPending || !isValid || !microStatus?.isMicroHolder}
                                className={cn(
                                    "w-full h-12 gap-3 text-xs font-bold uppercase tracking-widest transition-all",
                                    "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/10 rounded-xl",
                                    "disabled:opacity-20 translate-y-0 active:translate-y-0.5"
                                )}
                            >
                                {isPending ? (
                                    <>
                                        <Clock className="w-4 h-4 animate-spin" />
                                        Publication...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        {isEdit ? "Enregistrer les modifications" : "Publier le sondage"}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Discord Publication Setup Modal (Step 2) */}
        <Dialog open={showDiscordConfirm} onOpenChange={setShowDiscordConfirm}>
            <DialogContent className="max-w-md bg-zinc-950/95 border border-white/5 text-white backdrop-blur-xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-[#5865F2]">
                        <span className="p-2 bg-[#5865F2]/10 rounded-xl">
                            <Megaphone className="w-4 h-4 text-[#5865F2]" />
                        </span>
                        Annonce Discord
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Channel Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            Salon de publication
                        </label>
                        {discordChannels.length > 0 ? (
                            <select
                                value={selectedChannelId}
                                onChange={(e) => setSelectedChannelId(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl h-10 px-3 text-xs text-white focus:outline-none focus:border-cyan-500/30"
                            >
                                {discordChannels.map((ch) => (
                                    <option key={ch.id} value={ch.id}>
                                        #{ch.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-xs text-zinc-500 italic">Aucun salon disponible</p>
                        )}
                    </div>

                    {/* Mention Type Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            Type de mention (Ping)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { value: "none", label: "Aucune", desc: "Pas de ping" },
                                // 🔒 SECURITY: @everyone and @here are admin-only
                                ...(microStatus?.isAdmin || microStatus?.isSuperAdmin ? [
                                    { value: "everyone", label: "@everyone", desc: "Ping tout le monde" },
                                    { value: "here", label: "@here", desc: "Ping les présents" },
                                ] : []),
                                { value: "role", label: "Rôle", desc: "Ping un rôle whitelisté" }
                            ].map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => {
                                        setMentionType(type.value as any);
                                        if (type.value !== "role") setSelectedRoleId("");
                                    }}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                                        mentionType === type.value
                                            ? "bg-cyan-500/10 border-cyan-500/30 text-white"
                                            : "bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/10"
                                    )}
                                >
                                    <span className="text-xs font-bold">{type.label}</span>
                                    <span className="text-[9px] text-zinc-500 mt-0.5">{type.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Specific Role Dropdown */}
                    {mentionType === "role" && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                Sélectionnez le rôle
                            </label>
                            {discordRoles.filter(r => (microStatus?.isAdmin || microStatus?.isSuperAdmin) || pollsPingRoleIds.includes(r.id)).length > 0 ? (
                                <select
                                    value={selectedRoleId}
                                    onChange={(e) => setSelectedRoleId(e.target.value)}
                                    className="w-full bg-zinc-900 border border-white/5 rounded-xl h-10 px-3 text-xs text-white focus:outline-none focus:border-cyan-500/30"
                                >
                                    <option value="">-- Choisir un rôle --</option>
                                    {discordRoles
                                        .filter(r => (microStatus?.isAdmin || microStatus?.isSuperAdmin) || pollsPingRoleIds.includes(r.id))
                                        .map((role) => (
                                            <option key={role.id} value={role.id}>
                                                {role.name}
                                            </option>
                                        ))
                                    }
                                </select>
                            ) : (
                                <p className="text-[10px] text-amber-500 italic">
                                    Aucun rôle n'est configuré dans la whitelist de l'admin.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <Button
                        variant="ghost"
                        onClick={() => setShowDiscordConfirm(false)}
                        className="text-xs font-bold text-zinc-400 hover:text-white rounded-xl"
                    >
                        Retour
                    </Button>
                    <Button
                        onClick={() => {
                            if (mentionType === "role" && !selectedRoleId) {
                                return toast.error("Veuillez sélectionner un rôle à mentionner");
                            }
                            executeSubmit({
                                channelId: selectedChannelId,
                                mentionEveryone: mentionType === "everyone",
                                mentionRoleId: mentionType === "here" ? "here" : (mentionType === "role" ? selectedRoleId : undefined)
                            });
                        }}
                        disabled={isPending}
                        className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold uppercase tracking-wider px-6 h-11 rounded-xl flex items-center gap-2"
                    >
                        {isPending ? (
                            <>
                                <Clock className="w-4 h-4 animate-spin" />
                                Publication...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Confirmer & Publier
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
