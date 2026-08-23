"use client";

import { cn } from "@/lib/utils";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
    Users, CheckCircle2, XCircle, Crown, Swords, Clock,
    Trophy, Map, Link2, LogIn, LogOut, Trash2, Pencil, Bell, Layers, AlarmClock,
    Copy, Check
} from "lucide-react";
import {
    acceptDjParticipant,
    rejectDjParticipant,
    joinDjPost,
    leaveDjPost,
    deleteDjPost,
} from "@/server/actions/dungeon-finder-actions";
import { DjEditModal } from "./DjEditModal";
import { DjReminderModal } from "./DjReminderModal";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";

const MODE_LABELS: Record<string, string> = {
    FARM: "Farm", SUCCES: "Succès", MIXED: "Mixte", QUETE: "Quête", DONJON: "Donjon",
};

// Helper: Discord server nick > Dofus pseudo (set on registration) > Dofus in-game pseudo
function displayName(profile: { discordNickname?: string | null; pseudoDofus?: string | null; dofusPseudo?: string | null }) {
    return profile.discordNickname || profile.pseudoDofus || profile.dofusPseudo || "Membre";
}

interface DjPostDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: DjPostWithDetails;
    guildId: string;
    currentProfileId?: string;
    isAdmin?: boolean;
    onRefresh: () => void;
}

export function DjPostDetailModal({
    isOpen, onClose, post, guildId, currentProfileId, isAdmin, onRefresh
}: DjPostDetailModalProps) {
    const [classe, setClasse] = useState("");
    const [message, setMessage] = useState("");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    // #179 — copier les pseudos des joueurs inscrits / file d'attente
    const [copiedPseudos, setCopiedPseudos] = useState(false);

    const isOwner = post.profileId === currentProfileId;
    const myParticipation = currentProfileId
        ? post.participants.find((p) => p.profile.id === currentProfileId)
        : null;

    // Creator counts as 1 slot, ACCEPTED participants fill remaining slots
    const acceptedParticipants = post.participants.filter((p) => p.status === "ACCEPTED");
    const pendingParticipants = post.participants.filter((p) => p.status === "PENDING");
    const acceptedCount = acceptedParticipants.length + 1; // +1 for creator
    const spotsLeft = post.maxMembers - acceptedCount;

    // #179 — liste `/w Pseudo` (créateur + inscrits + file d'attente)
    const buildWhisperList = () => {
        const names = [displayName(post.profile)];
        acceptedParticipants.forEach((p) => names.push(displayName(p.profile)));
        pendingParticipants.forEach((p) => names.push(displayName(p.profile)));
        return names.map((n) => `/w ${n}`).join("\n");
    };

    const handleCopyPseudos = () => {
        const text = buildWhisperList();
        if (!text.trim()) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedPseudos(true);
            toast.success("Pseudos copiés !", { description: "Colle-les dans Discord pour chuchoter à tous." });
            setTimeout(() => setCopiedPseudos(false), 2000);
        }).catch(() => toast.error("Impossible de copier"));
    };

    function handleJoin() {
        startTransition(async () => {
            const res = await joinDjPost(guildId, post.id, { classe: classe || null, message: message || null });
            if (res.success) {
                const wasWaitlisted = (res as any).data?.waitlisted;
                toast.success(wasWaitlisted
                    ? "Tu es en file d'attente ! Le créateur sera notifié."
                    : "Candidature envoyée !"
                );
                onRefresh();
                onClose();
            } else {
                toast.error(res.error);
            }
        });
    }

    function handleLeave() {
        startTransition(async () => {
            const res = await leaveDjPost(guildId, post.id);
            if (res.success) { toast.success("Parti du post."); onRefresh(); onClose(); }
            else toast.error(res.error);
        });
    }

    function handleDelete() {
        if (!confirm("Voulez-vous vraiment supprimer ce post définitivement ?")) return;
        startTransition(async () => {
            const res = await deleteDjPost(guildId, post.id);
            if (res.success) {
                toast.success("Post supprimé définitivement.");
                onRefresh();
                onClose();
            } else toast.error(res.error);
        });
    }

    function handleAccept(participantId: string) {
        startTransition(async () => {
            const res = await acceptDjParticipant(guildId, post.id, participantId);
            if (res.success) { toast.success("Participant accepté !"); onRefresh(); }
            else toast.error(res.error);
        });
    }

    function handleReject(participantId: string) {
        startTransition(async () => {
            const res = await rejectDjParticipant(guildId, post.id, participantId);
            if (res.success) { toast.success("Participant retiré."); onRefresh(); }
            else toast.error(res.error);
        });
    }

    // Handled by DjReminderModal

    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-y-auto border-border bg-background text-foreground custom-scrollbar motion-reduce:animate-none">

                    {/* Hero Image / Banner */}
                    <div className="relative h-24 bg-surface border-b border-border overflow-hidden shrink-0">
                        {/* Ambiance : léger voile du visuel du donjon (flouté + fondu, jamais pixelisé) */}
                        {post.mode === "DONJON" && (post.dungeon?.imageUrl || (post.dungeonsJson as any[])?.[0]?.imageUrl) ? (
                            <img
                                src={post.dungeon?.imageUrl ?? (post.dungeonsJson as any[])?.[0]?.imageUrl}
                                alt=""
                                aria-hidden
                                className="absolute inset-0 w-full h-full object-cover opacity-[0.10] blur-2xl scale-110"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-r from-info/10 via-transparent to-transparent" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

                        <div className="relative z-10 flex items-center gap-4 px-5 h-full">
                            <div className={cn("w-16 h-16 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center border shadow-lg", post.mode === "DONJON" ? "bg-elevated/80 border-border" : "bg-info/80 border-info/30")}>
                                {post.mode === "DONJON" && (post.dungeon?.imageUrl || (post.dungeonsJson as any[])?.[0]?.imageUrl) ? (
                                    <img src={post.dungeon?.imageUrl ?? (post.dungeonsJson as any[])?.[0]?.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : post.mode === "DONJON" ? (
                                    <Swords className="w-6 h-6 text-muted-foreground" />
                                ) : (
                                    <Map className="w-6 h-6 text-info" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-black text-foreground truncate">
                                    {(post.dungeonsJson as any[])?.length > 0
                                        ? `Multi-donjons — ${(post.dungeonsJson as any[]).length}`
                                        : (post.mode === "DONJON" ? post.dungeon?.name : post.questName || "Quête")}
                                </h2>
                                <p className="text-sm font-medium text-muted-foreground">
                                    {(post.dungeonsJson as any[])?.length > 0
                                        ? "Session de guilde multi-donjons"
                                        : (post.mode === "DONJON" ? `Niv. ${post.dungeon?.level} — ${post.dungeon?.bossName}` : "Mode Quête")}
                                </p>
                            </div>
                            <Badge className={`text-caption font-black uppercase tracking-wider px-2.5 py-1 backdrop-blur-md ${post.status === "OPEN" ? "bg-success/10 text-success border-success/20 " : "bg-surface text-muted-foreground border-border"}`}>
                                {post.status === "OPEN" ? "Ouvert" : post.status === "FULL" ? "Complet" : "Fermé"}
                            </Badge>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Info grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-surface/40 rounded-xl p-4 border border-border shadow-inner">
                                <p className="text-muted-foreground text-caption uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" /> Mode</p>
                                <p className="font-black text-foreground text-base">{MODE_LABELS[post.mode] ?? post.mode}</p>
                            </div>
                            <div className="bg-surface/40 rounded-xl p-4 border border-border shadow-inner">
                                <p className="text-muted-foreground text-caption uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Places</p>
                                <p className={`font-black text-base ${spotsLeft === 0 ? "text-warning" : "text-success"}`}>
                                    {acceptedCount}/{post.maxMembers} — {spotsLeft > 0 ? <span className="text-foreground font-medium">{`${spotsLeft} dispo${spotsLeft > 1 ? "s" : ""}`}</span> : "Complet"}
                                </p>
                            </div>
                            {post.targetDate && (
                                <div className="bg-info/5 rounded-xl p-4 border border-info/10 col-span-2 shadow-inner">
                                    <p className="text-info/80 text-caption uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Date prévue</p>
                                    <p className="font-bold text-info">
                                        {new Date(post.targetDate).toLocaleDateString("fr-FR", {
                                            weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                                        }).replace(/, /g, " à ")}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Quest & Dungeon Guide Links (DPLN & Dofensive) */}
                        <div className="bg-info/5 border border-info/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex flex-1 items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-info/50 flex items-center justify-center shrink-0 border border-info/50">
                                    <Map className="w-4 h-4 text-info" />
                                </div>
                                <div>
                                    <p className="text-caption text-info/70 font-bold uppercase tracking-widest mb-0.5">Guides & Base de données</p>
                                    <span className="text-sm text-info font-bold">
                                        {(post.dungeonsJson as any[])?.length > 0
                                            ? `Multi-donjons — ${(post.dungeonsJson as any[]).length}`
                                            : (post.mode === "DONJON" ? post.dungeon?.name : post.questName || "Quête")}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {post.dungeon?.dofuspourlesnoobsUrl && (
                                    <a href={post.dungeon.dofuspourlesnoobsUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-caption font-bold text-warning hover:text-warning border border-warning/40 hover:border-warning/50 bg-warning/20 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5 shadow-sm">
                                        <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" /> DofusPourLesNoobs
                                    </a>
                                )}
                                {post.dungeon?.dofensiveUrl && (
                                    <a href={post.dungeon.dofensiveUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-caption font-bold text-success hover:text-success border border-success/40 hover:border-success/50 bg-success/20 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5 shadow-sm">
                                        <span>🛡️</span> Dofensive
                                    </a>
                                )}
                                {post.questUrl && post.questUrl.includes("dofuspourlesnoobs") && !post.dungeon?.dofuspourlesnoobsUrl && (
                                    <a href={post.questUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-caption font-bold text-warning hover:text-warning border border-warning/40 hover:border-warning/50 bg-warning/20 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5">
                                        <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" /> DofusPourLesNoobs
                                    </a>
                                )}
                                {post.questId && post.questId !== -1 && (
                                    <a href={`https://dofusdb.fr/fr/database/quest/${post.questId}`} target="_blank" rel="noopener noreferrer"
                                        className="text-caption font-bold text-foreground hover:text-foreground border border-border hover:border-border bg-surface rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5">
                                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="DofusDB" className="w-3.5 h-3.5 rounded-sm" /> DofusDB
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Multi-donjons : liste de la session (#26) */}
                        {(post.dungeonsJson as any[])?.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Donjons de la session</p>
                                {(post.dungeonsJson as any[]).map((d: any, idx: number) => (
                                    <div key={d.dungeonId ?? idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface/40 border border-border">
                                        {d.imageUrl ? (
                                            <img src={d.imageUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-background border border-border shrink-0 p-0.5" />
                                        ) : (
                                            <span className="w-9 h-9 rounded-lg bg-background border border-border shrink-0 flex items-center justify-center text-muted-foreground">
                                                <Swords className="w-4 h-4" />
                                            </span>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-foreground truncate">{d.name}</p>
                                            <p className="text-caption text-muted-foreground">
                                                Lvl {d.level}
                                                {(d.wantedAchievementIds?.length ?? 0) > 0 && ` · ${d.wantedAchievementIds.length} succès`}
                                                {d.targetDate && ` · ${new Date(d.targetDate).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`}
                                            </p>
                                        </div>
                                        <span className="text-caption font-black text-info/70 uppercase tracking-widest shrink-0">#{idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Message */}
                        {post.message && (
                            <div className="bg-surface/40 rounded-xl p-4 border-l-2 border-info shadow-inner">
                                <p className="text-sm text-foreground leading-relaxed italic opacity-90">"{post.message}"</p>
                            </div>
                        )}

                        {/* Wanted achievements */}
                        {post.wantedAchievementIds.length > 0 && post.dungeon && (
                            <div className="space-y-2">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Succès visés</p>
                                <div className="flex gap-2 flex-wrap">
                                    {post.dungeon.achievements
                                        .filter((a) => post.wantedAchievementIds.includes(a.id))
                                        .map((a) => (
                                            <div key={a.id} className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-lg px-2.5 py-1.5 shadow-sm">
                                                {a.challenge.iconUrl && (
                                                    <img src={a.challenge.iconUrl} alt="" className="w-4 h-4 object-contain" />
                                                )}
                                                <span className="text-xs text-warning font-bold">{a.challenge.name}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Required classes */}
                        {post.requiredClasses && post.requiredClasses.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Classes demandées</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {post.requiredClasses.map((c) => {
                                        const classData = getClass(c);
                                        return (
                                            <div key={c} className="flex items-center bg-info/10 border border-info/20 rounded-md p-1 shadow-sm px-2 gap-1.5">
                                                <div className="w-4 h-4 rounded overflow-hidden">
                                                    <img src={classData?.icon} alt={classData?.name || c} className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                </div>
                                                <span className="text-caption text-info font-medium">{classData?.name || c}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Participants list */}
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-2">
                                    <Users className="w-3 h-3" /> Participants ({acceptedCount}/{post.maxMembers})
                                </p>
                                {/* #179 — copier les pseudos des inscrits + file d'attente (format /w Pseudo) */}
                                {(acceptedCount > 1 || pendingParticipants.length > 0) && (
                                    <button
                                        type="button"
                                        onClick={handleCopyPseudos}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-caption text-muted-foreground font-bold hover:text-foreground hover:bg-elevated transition-colors"
                                        title="Copier les pseudos des joueurs (format /w Pseudo)"
                                    >
                                        {copiedPseudos ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copiedPseudos ? "Copié" : "Pseudos"}
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                {/* Creator row */}
                                <div className="flex items-center gap-4 bg-warning/5 rounded-xl p-3 border border-warning/10 shadow-sm relative overflow-hidden">
                                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-warning/40 ">
                                        {post.profile.user.image && <img src={post.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 min-w-0 z-10">
                                        <p className="text-sm font-black text-foreground truncate drop-shadow-sm">{displayName(post.profile)}</p>
                                        <span className="text-caption text-warning/80 font-bold flex items-center mt-0.5"><Crown className="w-3 h-3 mr-1 inline" /> Créateur du groupe</span>
                                    </div>
                                    <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-warning/10 to-transparent pointer-events-none" />
                                </div>

                                {/* Participants ACCEPTED */}
                                {acceptedParticipants.map((p) => (
                                    <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-surface/40 rounded-xl p-3 border border-border hover:bg-surface/60 transition-colors group">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-elevated shrink-0 ring-1 ring-white/10">
                                                {p.profile.user.image && <img src={p.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-bold text-foreground truncate group-hover:text-foreground transition-colors">{displayName(p.profile)}</p>
                                                    {p.classe && <Badge variant="outline" className="text-caption h-4 border-border text-muted-foreground px-1.5">{p.classe}</Badge>}
                                                    {(post.dungeonsJson as any[])?.length > 0 && p.dungeonIndex != null && (post.dungeonsJson as any[])[p.dungeonIndex]?.name && (
                                                        <Badge variant="outline" className="text-caption h-4 border-info text-info px-1.5 max-w-[120px] truncate">
                                                            {(post.dungeonsJson as any[])[p.dungeonIndex]?.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-caption text-muted-foreground mt-0.5">
                                                    Inscrit {format(new Date(p.createdAt), "d MMM à HH:mm", { locale: fr })}
                                                </p>
                                                {p.message && <p className="text-caption text-muted-foreground italic truncate mt-0.5 leading-tight">"{p.message}"</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                            <Badge className="text-caption font-bold uppercase tracking-wider text-success bg-success/10 border-success/20">
                                                Inscrit
                                            </Badge>
                                            {/* Owner actions */}
                                            {(isOwner || isAdmin) && post.status === "OPEN" && (
                                                <div className="flex gap-1 shrink-0 bg-surface/80 rounded-lg border border-border opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                                                    <Button size="icon" variant="ghost"
                                                        className="w-8 h-8 text-danger hover:bg-danger/20 hover:text-danger rounded-md"
                                                        onClick={() => handleReject(p.id)} disabled={isPending}
                                                        title="Retirer du groupe">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {acceptedParticipants.length === 0 && (
                                    <p className="text-center text-sm text-muted-foreground py-4">Aucun participant inscrit pour l'instant</p>
                                )}
                            </div>

                            {/* File d'attente (PENDING) */}
                            {pendingParticipants.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                                        <AlarmClock className="w-3 h-3" /> File d'attente ({pendingParticipants.length})
                                    </p>
                                    <div className="space-y-1.5">
                                        {pendingParticipants.map((p, idx) => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-warning/5 rounded-xl p-3 border border-warning/15 hover:bg-warning/10 transition-colors group">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-elevated shrink-0 ring-1 ring-warning/30">
                                                            {p.profile.user.image && <img src={p.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                                        </div>
                                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-warning text-warning-foreground text-caption font-black flex items-center justify-center">{idx + 1}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-bold text-foreground truncate">{displayName(p.profile)}</p>
                                                            {p.classe && <Badge variant="outline" className="text-caption h-4 border-border text-muted-foreground px-1.5">{p.classe}</Badge>}
                                                        </div>
                                                        <p className="text-caption text-muted-foreground mt-0.5">
                                                            En attente depuis {format(new Date(p.createdAt), "d MMM à HH:mm", { locale: fr })}
                                                        </p>
                                                        {p.message && <p className="text-caption text-muted-foreground italic truncate mt-0.5 leading-tight">"{p.message}"</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                                    {/* Owner actions */}
                                                    {(isOwner || isAdmin) && post.status === "OPEN" && (
                                                        <div className="flex gap-1 shrink-0 bg-surface/80 rounded-lg border border-border opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                                                            {spotsLeft > 0 && (
                                                                <Button size="icon" variant="ghost"
                                                                    className="w-8 h-8 text-success hover:bg-success/20 hover:text-success rounded-md"
                                                                    onClick={() => handleAccept(p.id)} disabled={isPending}
                                                                    title="Accepter dans le groupe">
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            <Button size="icon" variant="ghost"
                                                                className="w-8 h-8 text-danger hover:bg-danger/20 hover:text-danger rounded-md"
                                                                onClick={() => handleReject(p.id)} disabled={isPending}
                                                                title="Refuser">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Join form — visible si OPEN ou FULL (file d'attente) */}
                        {!isOwner && !myParticipation && (post.status === "OPEN" || post.status === "FULL") && (
                            <div className="border-t border-border pt-6 space-y-4">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">
                                    {spotsLeft > 0 ? "Candidature" : "Rejoindre la file d'attente"}
                                </p>
                                {spotsLeft <= 0 && (
                                    <div className="flex items-start gap-2.5 bg-warning/8 border border-warning/20 rounded-xl px-3.5 py-3">
                                        <AlarmClock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                                        <p className="text-xs text-foreground leading-relaxed">
                                            Le groupe est <strong>complet</strong>. Tu peux rejoindre la file d'attente — si une place se libère, le créateur pourra t'accepter.
                                        </p>
                                    </div>
                                )}
                                <div className="bg-surface/40 rounded-xl p-4 border border-border grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-inner">
                                    <div className="sm:col-span-1">
                                        <label className="text-caption text-muted-foreground font-bold uppercase tracking-widest block mb-2">Ta classe</label>
                                        <div className="grid grid-cols-6 gap-1.5 p-2 rounded-xl bg-surface border border-border shadow-inner">
                                            {DOFUS_CLASSES.map((c) => {
                                                const isSelected = classe === c.name;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        title={c.name}
                                                        onClick={() => setClasse(isSelected ? "" : c.name)}
                                                        className={cn(
                                                            "aspect-square rounded-lg flex items-center justify-center transition-all border group/class",
                                                            isSelected
                                                                ? "border-info/50 bg-info/20  scale-110 z-10"
                                                                : "border-transparent opacity-40 hover:opacity-100 hover:bg-surface hover:border-border"
                                                        )}
                                                    >
                                                        <img
                                                            src={c.icon}
                                                            alt={c.name}
                                                            className="w-5 h-5 object-contain drop-shadow-md group-hover/class:scale-110 transition-transform"
                                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                                        />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-caption text-muted-foreground font-bold uppercase tracking-widest block mb-1.5">Message (opt.)</label>
                                        <input
                                            type="text"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                                            placeholder="Ex: Dispo toute la soirée, j'ai le stuff..."
                                            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 shadow-inner"
                                        />
                                    </div>
                                </div>
                                <Button
                                    className={cn(
                                        "w-full font-black h-12 shadow-lg",
                                        spotsLeft > 0
                                            ? "bg-info/15 text-info border border-info/30 hover:bg-info hover:text-info-foreground"
                                            : "bg-warning/15 text-warning border border-warning/30 hover:bg-warning hover:text-warning-foreground"
                                    )}
                                    onClick={handleJoin}
                                    disabled={isPending}
                                >
                                    <LogIn className="w-5 h-5 mr-2" />
                                    {spotsLeft > 0 ? "Envoyer ma candidature" : "Rejoindre la file d'attente"}
                                </Button>
                            </div>
                        )}

                        {/* My pending / waitlist status */}
                        {myParticipation?.status === "PENDING" && (
                            <div className="border-t border-border pt-5 flex items-center justify-between">
                                <p className="text-sm font-bold text-warning flex items-center gap-2">
                                    <AlarmClock className="w-4 h-4" /> En file d'attente — le créateur peut t'accepter si une place se libère
                                </p>
                                <Button size="sm" variant="outline" onClick={handleLeave} disabled={isPending}
                                    className="border-danger/50 bg-danger/20 text-danger hover:bg-danger/40 hover:text-danger">
                                    <LogOut className="w-4 h-4 mr-1.5" /> Se retirer
                                </Button>
                            </div>
                        )}

                        {/* Creator actions */}
                        {(isOwner || isAdmin) && post.status === "OPEN" && (
                            <div className="border-t border-border pt-5 flex gap-3">
                                {isOwner && (
                                    <>
                                        {post.isDiscordPublished && post.discordMessageId && acceptedCount > 1 && (
                                            <Button
                                                variant="outline"
                                                className="border-warning/30 bg-warning/10 text-warning hover:text-warning hover:bg-warning/30 font-bold h-11 transition-all px-4"
                                                onClick={() => setIsReminderModalOpen(true)}
                                                disabled={isPending}
                                                title="Envoyer une relance personnalisée aux participants"
                                            >
                                                <Bell className="w-4 h-4 mr-2" />
                                                Relancer
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-border bg-surface text-foreground hover:text-foreground hover:bg-surface font-bold h-11 transition-all"
                                            onClick={() => setIsEditModalOpen(true)}
                                            disabled={isPending}
                                        >
                                            <Pencil className="w-4 h-4 mr-2" strokeWidth={2.5} />
                                            Modifier le groupe
                                        </Button>
                                    </>
                                )}
                                <Button
                                    variant="outline"
                                    className="flex-1 border-danger/40 bg-danger/20 text-danger hover:bg-danger/40 hover:text-danger font-bold h-11 transition-all"
                                    onClick={handleDelete}
                                    disabled={isPending}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer le groupe
                                </Button>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {isOwner && (
                <DjEditModal
                    isOpen={isEditModalOpen}
                    post={post}
                    guildId={guildId}
                    onClose={() => setIsEditModalOpen(false)}
                    onSaved={() => { onRefresh(); }}
                />
            )}
            {isOwner && (
                <DjReminderModal
                    isOpen={isReminderModalOpen}
                    post={post}
                    guildId={guildId}
                    onClose={() => setIsReminderModalOpen(false)}
                />
            )}
        </>
    );
}
