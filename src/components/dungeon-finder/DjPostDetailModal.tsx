"use client";

import { cn } from "@/lib/utils";
import { normalizeChallengeIconUrl } from "@/lib/dofus-image-url";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
    Users, CheckCircle2, Swords, Map, Zap, LogIn, LogOut, Trash2, Pencil, Bell, Layers, AlarmClock,
} from "lucide-react";
import {
    acceptDjParticipant,
    rejectDjParticipant,
    joinDjPost,
    leaveDjPost,
} from "@/server/actions/dungeon-finder-actions";
import { DjEditModal } from "./DjEditModal";
import { DjCloseModal } from "./DjCloseModal";
import { DjReminderModal } from "./DjReminderModal";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import { DofusUiIcon } from "@/components/shared/dofus-ui-icon";
import { PseudoChip } from "@/components/shared/pseudo-chip";
import { getMultiDungeons, getDjPostTitle, getDjPostSubtitle, formatDjDateLabel } from "@/lib/dungeon-finder-utils";
import { dungeonFicheHref } from "@/lib/dungeon-fiche";
import { DjMultiBossAvatars } from "./DjMultiBossAvatars";

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
    // Clôture (bilan des succès/points + fermeture Discord) : action principale du
    // créateur. La suppression du groupe a été retirée (elle détruisait le bilan).
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const isOwner = post.profileId === currentProfileId;
    const myParticipation = currentProfileId
        ? post.participants.find((p) => p.profile.id === currentProfileId)
        : null;

    // Multi-donjons
    const multiDungeons = getMultiDungeons(post.dungeonsJson);
    const isMulti = multiDungeons.length > 0;
    const postTitle = getDjPostTitle(post);
    const postSubtitle = getDjPostSubtitle(post);
    const coverImage = !isMulti
        ? (post.mode === "DONJON"
            ? (post.dungeon?.imageUrl || "/assets/dofus/modules/dofus.png")
            : post.mode === "QUETE"
            ? "/assets/dofus/modules/quest.png"
            : post.mode === "DEFI"
            ? (post.defi?.imageUrl || "/assets/dofus/icons/challenges.png")
            : post.mode === "TITAN"
            ? (post.titan?.imageUrl || "/assets/dofus/icons/crown.png")
            : null)
        : null;

    // Creator counts as 1 slot, ACCEPTED participants fill remaining slots
    const acceptedParticipants = post.participants.filter((p) => p.status === "ACCEPTED");
    const pendingParticipants = post.participants.filter((p) => p.status === "PENDING");
    const acceptedCount = acceptedParticipants.length + 1; // +1 for creator
    const spotsLeft = post.maxMembers - acceptedCount;

    // #179 — la copie des pseudos est UNITAIRE (voir `PseudoChip`) : plus de bouton
    // global qui collait toute la liste `\n/w Pseudo`.

    function handleJoin() {
        startTransition(async () => {
            const res = await joinDjPost(guildId, post.id, { classe: classe || null, message: message || null });
            if (res.success) {
                const wasWaitlisted = (res as any).data?.waitlisted;
                toast.success(wasWaitlisted
                    ? "Tu as été placé en file d'attente !"
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
                    <div className="relative h-24 bg-surface/80 border-b border-border/70 overflow-hidden shrink-0">
                        {/* Ambiance : halo vert émeraude discret et fond de carte épuré */}
                        {(isMulti && multiDungeons[0]?.imageUrl) || (!isMulti && coverImage) ? (
                            <img
                                src={isMulti ? multiDungeons[0]!.imageUrl! : coverImage!}
                                alt=""
                                aria-hidden
                                className="absolute inset-0 w-full h-full object-cover opacity-[0.12] blur-xl scale-110"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

                        <div className="relative z-10 flex items-center gap-4 px-5 h-full">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center border border-border/70 bg-surface/90 shadow-md p-1.5">
                                {isMulti ? (
                                    <DjMultiBossAvatars dungeons={multiDungeons} size="lg" />
                                ) : coverImage ? (
                                    <img src={coverImage} alt="" className="w-full h-full object-contain" />
                                ) : post.mode === "DEFI" ? (
                                    <Zap className="w-6 h-6 text-amber-500" />
                                ) : post.mode === "DONJON" ? (
                                    <Swords className="w-6 h-6 text-muted-foreground" />
                                ) : (
                                    <Map className="w-6 h-6 text-emerald-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-foreground truncate">
                                    {postTitle}
                                </h2>
                                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
                                    {postSubtitle}
                                </p>
                            </div>
                            {post.status === "OPEN" ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-mono font-semibold bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 shrink-0 shadow-sm shadow-emerald-950/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                                    Ouvert
                                </span>
                            ) : post.status === "FULL" ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-mono font-semibold bg-amber-950/40 border border-amber-500/30 text-amber-400 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Complet
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-mono font-medium bg-muted/40 border border-border text-muted-foreground shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                                    Fermé
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Info grid */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-surface/50 rounded-xl p-3.5 border border-border/70">
                                <p className="text-muted-foreground text-caption uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><DofusUiIcon name="dungeon" size={13} /> Mode</p>
                                <p className="font-bold text-foreground text-sm">{MODE_LABELS[post.mode] ?? post.mode}</p>
                            </div>
                            <div className="bg-surface/50 rounded-xl p-3.5 border border-border/70">
                                <p className="text-muted-foreground text-caption uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><DofusUiIcon name="player" size={13} /> Places</p>
                                <p className="font-bold text-foreground text-sm">
                                    {acceptedCount}/{post.maxMembers} — {spotsLeft > 0 ? <span className="text-emerald-400 font-mono font-medium">{`${spotsLeft} dispo${spotsLeft > 1 ? "s" : ""}`}</span> : <span className="text-amber-400 font-mono">Complet</span>}
                                </p>
                            </div>
                            {post.targetDate && (
                                <div className="bg-surface/50 rounded-xl p-3.5 border border-border/70 col-span-2">
                                    <p className="text-muted-foreground text-caption uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><DofusUiIcon name="date" size={13} /> Date prévue</p>
                                    <p className="font-bold text-foreground text-sm">
                                        {formatDjDateLabel(post.targetDate)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Quest & Dungeon Guide Links (DPLN & Dofensive) */}
                        <div className="bg-surface/50 border border-border/70 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex flex-1 items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface/80 border border-border/70 flex items-center justify-center shrink-0">
                                    <DofusUiIcon name={post.mode === "QUETE" ? "quest" : "dungeon"} size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Guides & Base de données</p>
                                    <span className="text-sm text-foreground font-bold">
                                        {postTitle}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {post.dungeon?.dofuspourlesnoobsUrl && (
                                    <a href={post.dungeon.dofuspourlesnoobsUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-caption font-semibold text-muted-foreground hover:text-foreground border border-border/70 hover:bg-surface/80 rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1.5">
                                        <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" /> DofusPourLesNoobs
                                    </a>
                                )}
                                {(() => {
                                    const ficheHref = dungeonFicheHref(guildId, post.dungeon);
                                    if (!ficheHref) return null;
                                    return (
                                        <a href={ficheHref} target="_blank" rel="noopener noreferrer"
                                            className="text-caption font-semibold text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950/20 rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1.5">
                                            <img src="/assets/ui/logo-v2.png" alt="SigilOS" className="w-3.5 h-3.5 rounded-sm object-contain" /> Fiche SigilOS
                                        </a>
                                    );
                                })()}
                                {post.questUrl && post.questUrl.includes("dofuspourlesnoobs") && !post.dungeon?.dofuspourlesnoobsUrl && (
                                    <a href={post.questUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-caption font-semibold text-muted-foreground hover:text-foreground border border-border/70 hover:bg-surface/80 rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1.5">
                                        <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" /> DofusPourLesNoobs
                                    </a>
                                )}
                                {post.questId && post.questId !== -1 && (
                                    <a href={`https://dofusdb.fr/fr/database/quest/${post.questId}`} target="_blank" rel="noopener noreferrer"
                                        className="text-caption font-semibold text-muted-foreground hover:text-emerald-400 border border-border/70 hover:bg-surface/80 rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1.5">
                                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="DofusDB" className="w-3.5 h-3.5 rounded-sm" /> DofusDB
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Multi-donjons : liste de la session (#26) */}
                        {isMulti && (
                            <div className="space-y-2">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Donjons de la session</p>
                                {multiDungeons.map((d, idx) => (
                                    <div key={d.dungeonId ?? idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface/50 border border-border/70">
                                        {d.imageUrl ? (
                                            <img src={d.imageUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-background border border-border/70 shrink-0 p-0.5" />
                                        ) : (
                                            <span className="w-9 h-9 rounded-lg bg-background border border-border/70 shrink-0 flex items-center justify-center text-muted-foreground">
                                                <Swords className="w-4 h-4" />
                                            </span>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-foreground truncate">{d.name}</p>
                                            <p className="text-caption text-muted-foreground font-mono">
                                                Lvl {d.level}
                                                {(d.wantedAchievementIds?.length ?? 0) > 0 && ` · ${d.wantedAchievementIds!.length} succès`}
                                                {d.targetDate ? ` · ${formatDjDateLabel(d.targetDate, { shortMonth: true }) ?? ""}` : ""}
                                            </p>
                                        </div>
                                        <span className="text-caption font-mono font-bold text-muted-foreground uppercase tracking-wider shrink-0">#{idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Message */}
                        {post.message && (
                            <div className="bg-surface/40 rounded-xl p-3.5 border border-border/70 border-l-2 border-l-emerald-500/60 min-w-0">
                                <p className="text-sm text-foreground leading-relaxed italic opacity-90 break-words [overflow-wrap:anywhere] break-all">
                                    &ldquo;{post.message.length > 200 ? `${post.message.slice(0, 200)}…` : post.message}&rdquo;
                                </p>
                            </div>
                        )}

                        {/* Wanted achievements */}
                        {post.wantedAchievementIds.length > 0 && post.dungeon && (
                            <div className="space-y-2">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5"><DofusUiIcon name="trophy" size={14} /> Succès visés</p>
                                <div className="flex gap-2 flex-wrap">
                                    {post.dungeon.achievements
                                        .filter((a) => post.wantedAchievementIds.includes(a.id))
                                        .map((a) => (
                                             <div key={a.id} className="flex items-center gap-2 bg-surface/50 border border-border/70 rounded-lg px-2.5 py-1.5 hover:border-emerald-500/30 transition-colors">
                                                {a.challenge.iconUrl && (
                                                    <img src={normalizeChallengeIconUrl(a.challenge.iconUrl) ?? a.challenge.iconUrl} alt="" className="w-4 h-4 object-contain" />
                                                )}
                                                <span className="text-xs text-foreground font-semibold">{a.challenge.name}</span>
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
                                            <div key={c} className="flex items-center bg-surface/50 border border-border/70 rounded-lg py-1 px-2.5 gap-1.5">
                                                <div className="w-4 h-4 rounded overflow-hidden">
                                                    <img src={classData?.icon} alt={classData?.name || c} className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                </div>
                                                <span className="text-caption text-foreground font-medium">{classData?.name || c}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Participants list */}
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-2.5">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" /> Participants ({acceptedCount}/{post.maxMembers})
                                </p>
                            </div>
                            <div className="space-y-2">
                                {/* Creator row */}
                                <div className="flex items-center gap-3.5 bg-surface/60 rounded-xl p-3 border border-border/80 shadow-sm">
                                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-1 ring-border/80">
                                        {post.profile.user.image && <img src={post.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <PseudoChip
                                            pseudo={displayName(post.profile)}
                                            classe={post.profile.classe}
                                            className="text-sm font-bold text-foreground"
                                        />
                                        <span className="text-caption text-muted-foreground font-semibold flex items-center mt-0.5">
                                            <DofusUiIcon name="leader" size={12} className="mr-1" /> Créateur du groupe
                                        </span>
                                    </div>
                                </div>

                                {/* Participants ACCEPTED */}
                                {acceptedParticipants.map((p) => (
                                    <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-surface/40 rounded-xl p-3 border border-border/60 hover:bg-surface/60 hover:border-emerald-500/30 transition-all group">
                                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-elevated shrink-0 ring-1 ring-border/70">
                                                {p.profile.user.image && <img src={p.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <PseudoChip
                                                        pseudo={displayName(p.profile)}
                                                        classe={p.classe}
                                                        className="text-sm font-bold text-foreground"
                                                    />
                                                    {(post.dungeonsJson as any[])?.length > 0 && p.dungeonIndex != null && (post.dungeonsJson as any[])[p.dungeonIndex]?.name && (
                                                        <Badge variant="outline" className="text-caption h-4 border-border/60 text-muted-foreground px-1.5 max-w-[120px] truncate">
                                                            {(post.dungeonsJson as any[])[p.dungeonIndex]?.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-caption text-muted-foreground mt-0.5">
                                                    Inscrit {format(new Date(p.createdAt), "d MMM à HH:mm", { locale: fr })}
                                                </p>
                                                {p.message && <p className="text-caption text-muted-foreground italic truncate mt-0.5 leading-tight">&ldquo;{p.message}&rdquo;</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                Inscrit
                                            </span>
                                            {/* Self leave button — visible only for the current participant */}
                                            {p.profile.id === currentProfileId && post.status === "OPEN" && (
                                                <Button size="sm" variant="outline"
                                                    className="border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger h-8 px-2.5 text-xs font-bold rounded-lg"
                                                    onClick={handleLeave} disabled={isPending}
                                                    title="Se désinscrire">
                                                    <LogOut className="w-3.5 h-3.5 mr-1" />
                                                    Quitter
                                                </Button>
                                            )}
                                            {/* Owner / admin actions */}
                                            {(isOwner || isAdmin) && p.profile.id !== currentProfileId && post.status === "OPEN" && (
                                                <div className="flex gap-1 shrink-0 bg-surface/80 rounded-lg border border-border/70 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
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
                                        <AlarmClock className="w-3.5 h-3.5 text-amber-400" /> File d'attente ({pendingParticipants.length})
                                    </p>
                                    <div className="space-y-1.5">
                                        {pendingParticipants.map((p, idx) => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-surface/40 rounded-xl p-3 border border-border/60 hover:bg-surface/60 transition-colors group">
                                                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-elevated shrink-0 ring-1 ring-border/70">
                                                            {p.profile.user.image && <img src={p.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                                        </div>
                                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full border border-border/70 bg-elevated text-foreground text-caption font-bold flex items-center justify-center">{idx + 1}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <PseudoChip
                                                                pseudo={displayName(p.profile)}
                                                                classe={p.classe}
                                                                className="text-sm font-bold text-foreground"
                                                            />
                                                        </div>
                                                        <p className="text-caption text-muted-foreground mt-0.5">
                                                            En attente depuis {format(new Date(p.createdAt), "d MMM à HH:mm", { locale: fr })}
                                                        </p>
                                                        {p.message && <p className="text-caption text-muted-foreground italic truncate mt-0.5 leading-tight">&ldquo;{p.message}&rdquo;</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                                    {/* Owner actions */}
                                                    {(isOwner || isAdmin) && post.status === "OPEN" && (
                                                        <div className="flex gap-1 shrink-0 bg-surface/80 rounded-lg border border-border/70 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                                                            {spotsLeft > 0 && (
                                                                <Button size="icon" variant="ghost"
                                                                    className="w-8 h-8 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-md"
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
                            <div className="border-t border-border/70 pt-6 space-y-4">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">
                                    {spotsLeft > 0 ? "Candidature" : "Rejoindre la file d'attente"}
                                </p>
                                {spotsLeft <= 0 && (
                                    <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-3">
                                        <AlarmClock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                        <p className="text-xs text-foreground leading-relaxed">
                                            Le groupe est <strong>complet</strong>. Tu peux rejoindre la file d'attente — si une place se libère, le créateur pourra t'accepter.
                                        </p>
                                    </div>
                                )}
                                <div className="bg-surface/50 rounded-xl p-4 border border-border/70 grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="text-caption text-muted-foreground font-bold uppercase tracking-widest block mb-2">Ta classe</label>
                                        <div className="grid grid-cols-7 sm:grid-cols-10 gap-2 p-2 rounded-xl bg-surface/70 border border-border/60">
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
                                                                ? "border-emerald-500 bg-emerald-500/20 scale-105 z-10 shadow-sm shadow-emerald-950/40"
                                                                : "border-border/40 opacity-40 hover:opacity-100 hover:bg-surface hover:border-border"
                                                        )}
                                                    >
                                                        <img
                                                            src={c.icon}
                                                            alt={c.name}
                                                            className="w-7 h-7 object-contain drop-shadow-md group-hover/class:scale-110 transition-transform"
                                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                                        />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-caption text-muted-foreground font-bold uppercase tracking-widest block">Message (opt.)</label>
                                            <span className="text-[11px] font-mono text-muted-foreground">{message.length}/200</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={message}
                                            maxLength={200}
                                            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                                            placeholder="Ex: Dispo toute la soirée, j'ai le stuff..."
                                            className="w-full bg-surface/60 border border-border/70 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                </div>
                                <Button
                                    className={cn(
                                        "w-full font-bold h-11 rounded-xl shadow-md transition-all cursor-pointer",
                                        spotsLeft > 0
                                            ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-950/20 border border-emerald-400/40"
                                            : "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black"
                                    )}
                                    onClick={handleJoin}
                                    disabled={isPending}
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    {spotsLeft > 0 ? "Envoyer ma candidature" : "Rejoindre la file d'attente"}
                                </Button>
                            </div>
                        )}

                        {/* My pending / waitlist status */}
                        {myParticipation?.status === "PENDING" && (
                            <div className="border-t border-border/70 pt-5 flex items-center justify-between">
                                <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                                    <AlarmClock className="w-4 h-4" /> En file d'attente — le créateur peut t'accepter si une place se libère
                                </p>
                                <Button size="sm" variant="outline" onClick={handleLeave} disabled={isPending}
                                    className="border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger rounded-lg">
                                    <LogOut className="w-4 h-4 mr-1.5" /> Se retirer
                                </Button>
                            </div>
                        )}

                        {/* My accepted status — se désinscrire */}
                        {myParticipation?.status === "ACCEPTED" && !isOwner && post.status === "OPEN" && (
                            <div className="border-t border-border/70 pt-5 flex items-center justify-between gap-4">
                                <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Tu es inscrit à ce post
                                </p>
                                <Button size="sm" variant="outline" onClick={handleLeave} disabled={isPending}
                                    className="shrink-0 border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger rounded-lg">
                                    <LogOut className="w-4 h-4 mr-1.5" /> Se désinscrire
                                </Button>
                            </div>
                        )}

                        {/* Actions du créateur (ou d'un admin) : relancer, modifier, TERMINER. */}
                        {(isOwner || isAdmin) && (post.status === "OPEN" || post.status === "FULL") && (
                            <div className="border-t border-border/70 pt-5 flex flex-wrap gap-3">
                                {isOwner && (
                                    <>
                                        {post.isDiscordPublished && post.discordMessageId && acceptedCount > 1 && (
                                            <Button
                                                variant="outline"
                                                className="border-amber-500/30 bg-amber-500/10 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 font-bold h-11 transition-all px-4 rounded-xl"
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
                                            className="flex-1 min-w-[180px] border-border/70 bg-surface/60 text-foreground hover:text-foreground hover:bg-surface font-bold h-11 transition-all rounded-xl"
                                            onClick={() => setIsEditModalOpen(true)}
                                            disabled={isPending}
                                        >
                                            <Pencil className="w-4 h-4 mr-2 stroke-[2.5]" />
                                            Modifier le groupe
                                        </Button>
                                    </>
                                )}
                                <Button
                                    className="flex-1 min-w-[180px] bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 font-bold h-11 transition-all rounded-xl cursor-pointer"
                                    onClick={() => setIsCloseModalOpen(true)}
                                    disabled={isPending}
                                    title={isOwner ? "Terminer le post (bilan + clôture Discord)" : "Fermer le post (admin)"}
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    {isOwner ? "Terminer le post" : "Fermer le post"}
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
            {/* Clôture : ouverte depuis la fiche comme depuis la carte (même modale,
                même bilan) — un seul chemin de code pour terminer un post. */}
            {(isOwner || isAdmin) && (
                <DjCloseModal
                    isOpen={isCloseModalOpen}
                    post={post}
                    guildId={guildId}
                    adminMode={!!isAdmin && !isOwner}
                    onClose={() => setIsCloseModalOpen(false)}
                    onClosed={() => {
                        setIsCloseModalOpen(false);
                        onRefresh();
                        onClose();
                    }}
                />
            )}
        </>
    );
}
