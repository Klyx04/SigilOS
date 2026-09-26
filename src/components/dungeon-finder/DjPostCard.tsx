"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Users, Clock,
    XCircle, LogIn, LogOut, CheckCircle2
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClassIcon } from "@/components/shared/class-icon";
import { DofusUiIcon, type DofusUiIconName } from "@/components/shared/dofus-ui-icon";
import { PseudoChip } from "@/components/shared/pseudo-chip";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
import { leaveDjPost } from "@/server/actions/dungeon-finder-actions";
import { DjPostDetailModal } from "./DjPostDetailModal";
import { DjCloseModal } from "./DjCloseModal";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getClass } from "@/lib/dofus-assets";
import { getMultiDungeons, getDjPostTitle, getDjPostSubtitle, formatDjDateLabel } from "@/lib/dungeon-finder-utils";
import { DjMultiBossAvatars } from "./DjMultiBossAvatars";

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const MODE_META: Record<string, { label: string; asset: DofusUiIconName }> = {
    DONJON: { label: "Donjon", asset: "dungeon" },
    QUETE: { label: "Quête", asset: "quest" },
    DEFI: { label: "Défi", asset: "challenge" },
};

// Statut en picto Dofus (cadenas ouvert/fermé) sur surface neutre : plus de
// pastilles vert/ambre qui donnaient trois couleurs à une seule carte.
const STATUS_META: Record<string, { label: string; asset: DofusUiIconName }> = {
    OPEN: { label: "Ouvert", asset: "open" },
    FULL: { label: "Complet", asset: "closed" },
    CLOSED: { label: "Fermé", asset: "closed" },
    EXPIRED: { label: "Expiré", asset: "closed" },
};

// -------------------------------------------------------
// DjPostCard
// -------------------------------------------------------

interface DjPostCardProps {
    post: DjPostWithDetails;
    guildId: string;
    currentProfileId?: string;
    isAdmin?: boolean;
    onRefresh: () => void;
}

export function DjPostCard({ post, guildId, currentProfileId, isAdmin, onRefresh }: DjPostCardProps) {
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const isOwner = post.profileId === currentProfileId;
    const myParticipation = currentProfileId
        ? post.participants.find((p) => p.profile.id === currentProfileId)
        : null;

    const acceptedCount = post._acceptedCount + 1; // +1 creator
    const spotsLeft = post.maxMembers - acceptedCount;

    const modeMeta = MODE_META[post.mode] ?? MODE_META.DONJON;
    const statusMeta = STATUS_META[post.status] ?? STATUS_META.OPEN;

    function handleLeave() {
        startTransition(async () => {
            const res = await leaveDjPost(guildId, post.id);
            if (res.success) {
                toast.success("Tu t'es retiré du post.");
                onRefresh();
            } else {
                toast.error(res.error);
            }
        });
    }

    const multiDungeons = getMultiDungeons(post.dungeonsJson);
    const isMulti = multiDungeons.length > 0;
    const title = getDjPostTitle(post);
    const subtitle = getDjPostSubtitle(post);
    const coverImage = !isMulti
        ? (post.mode === "DONJON" ? post.dungeon?.imageUrl : post.mode === "DEFI" ? post.defi?.imageUrl : null)
        : null;

    const isOpen = post.status === "OPEN" || post.status === "FULL";
    const isDonjon = post.mode === "DONJON";

    return (
        <>
            <div
                className={cn(
                    "group relative rounded-2xl border overflow-hidden flex flex-col h-full transition-all duration-200",
                    isOpen
                        ? "bg-surface/40 border-border hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg hover:shadow-black/20"
                        : "bg-background/40 border-border opacity-50",
                    "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none"
                )}
            >
                {/* Banner */}
                <div className="relative h-28 bg-surface overflow-hidden flex items-center shrink-0 border-b border-border">
                    {isMulti && multiDungeons[0]?.imageUrl ? (
                        <img
                            src={multiDungeons[0].imageUrl}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 w-full h-full object-cover opacity-[0.08] blur-xl scale-125"
                        />
                    ) : null}

                    <div className="relative flex items-center gap-4 px-5 w-full">
                        <div className={cn(
                            "w-14 h-14 rounded-xl overflow-hidden shrink-0 flex flex-col items-center justify-center border shadow-sm",
                            isOpen ? "bg-surface border-border-strong" : "bg-background border-border"
                        )}>
                            {isMulti ? (
                                <DjMultiBossAvatars dungeons={multiDungeons} />
                            ) : coverImage ? (
                                <img src={coverImage} alt={subtitle} className="w-full h-full object-cover" />
                            ) : (
                                <DofusUiIcon name={modeMeta.asset} size={26} className="opacity-70" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <h3
                                    className="font-black text-foreground text-base leading-tight tracking-tight line-clamp-2"
                                    title={title || ""}
                                >
                                    {title}
                                </h3>
                                {isDonjon && post.dungeon?.isOcreQuest && (
                                    <img
                                        src="/module-dofus/Dofus_Ocre.png"
                                        alt="Quête Ocre"
                                        title="Donjon de la Quête Ocre"
                                        className="w-4 h-4 object-contain shrink-0"
                                    />
                                )}
                            </div>
                            <p className="text-caption font-black text-muted-foreground uppercase tracking-widest truncate mt-1">
                                {subtitle}
                            </p>
                        </div>
                        {/* Statut : picto Dofus (cadenas) + surface neutre, plus de pastille */}
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-caption font-black uppercase tracking-wider shrink-0 self-start",
                            isOpen
                                ? "border-border-strong bg-elevated text-foreground"
                                : "border-border bg-surface/40 text-muted-foreground"
                        )}>
                            <DofusUiIcon name={statusMeta.asset} size={13} className={isOpen ? undefined : "opacity-60"} />
                            {statusMeta.label}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1 gap-5">
                    {/* Mode + Slots */}
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                        <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-3 py-1.5 text-caption font-black uppercase tracking-widest text-foreground">
                            <DofusUiIcon name={modeMeta.asset} size={14} />
                            {modeMeta.label}
                        </span>

                        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-3 py-1.5 text-caption font-black text-foreground">
                            <DofusUiIcon name="player" size={13} className="opacity-80" />
                            <span>
                                {acceptedCount} <span className="mx-0.5 font-normal text-muted-foreground">/</span> {post.maxMembers}
                            </span>
                            {spotsLeft > 0 && <span className="text-muted-foreground">+{spotsLeft}</span>}
                        </div>
                    </div>

                    {/* Rendez-vous — ligne compacte : plus de bandeau plein largeur */}
                    {post.targetDate && (
                        <div className="flex items-center gap-2 text-caption font-black group/date">
                            <DofusUiIcon name="date" size={14} className={cn("transition-transform group-hover/date:scale-110", !isOpen && "opacity-60")} />
                            <span className={cn(
                                "uppercase tracking-tight",
                                isOpen ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {formatDjDateLabel(post.targetDate, { shortWeekday: true }) ?? ""}
                            </span>
                        </div>
                    )}

                    {/* Participants Bubbles & Waitlist */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex -space-x-2 overflow-hidden py-1">
                            {/* Leader */}
                            <div key={post.profileId} className="relative group/avatar animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none" title={`${post.profile.pseudoDofus || post.profile.discordNickname} (LEAD)`}>
                                <Avatar className="h-9 w-9 ring-2 ring-ring transition-all border-2 border-border shadow-lg">
                                    <DiscordAvatarImage src={post.profile.user.image || undefined} />
                                    <AvatarFallback className="bg-elevated text-foreground text-caption font-black">
                                        {(post.profile.pseudoDofus || post.profile.discordNickname || "??").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-border bg-background p-[2px]">
                                    <DofusUiIcon name="leader" size={9} />
                                </div>
                                {post.profile.classe && (
                                    <div className="absolute bottom-0 left-0 rounded-tr-md bg-background/90 p-[1px]" title={post.profile.classe}>
                                        <ClassIcon classId={post.profile.classe} size={10} />
                                    </div>
                                )}
                            </div>

                            {/* Others ACCEPTED only */}
                            {post.participants.filter((p) => p.status === "ACCEPTED").map((p) => (
                                <div key={p.id} className="relative group/avatar animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none" title={p.profile.pseudoDofus || p.profile.discordNickname || "Membre"}>
                                    <Avatar className="h-9 w-9 ring-2 ring-border hover:ring-ring/50 transition-all border-2 border-border shadow-lg">
                                        <DiscordAvatarImage src={p.profile.user.image || undefined} />
                                        <AvatarFallback className="bg-elevated text-muted-foreground text-caption font-bold">
                                            {(p.profile.pseudoDofus || p.profile.discordNickname || "??").slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {p.classe && (
                                        <div className="absolute bottom-0 left-0 rounded-tr-md bg-background/90 p-[1px]" title={p.classe}>
                                            <ClassIcon classId={p.classe} size={10} />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Empty Spots */}
                            {Array.from({ length: Math.max(0, Math.min(spotsLeft, 10)) }).map((_, i) => (
                                <div key={`empty-${i}`} className="w-9 h-9 rounded-full border-2 border-dashed border-border bg-surface flex items-center justify-center">
                                    <Users className="w-3.5 h-3.5 text-muted-foreground/25" />
                                </div>
                            ))}
                        </div>

                        {/* Waitlist pill if any pending */}
                        {post.participants.filter((p) => p.status === "PENDING").length > 0 && (
                            <div
                                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/40 px-2.5 py-1 text-caption font-black uppercase tracking-wider text-muted-foreground"
                                title="Joueurs en file d'attente"
                            >
                                <DofusUiIcon name="hourglass" size={12} />
                                <span>{post.participants.filter((p) => p.status === "PENDING").length} en attente</span>
                            </div>
                        )}
                    </div>

                    {/* Wanted achievements */}
                    {post.wantedAchievementIds.length > 0 && post.dungeon && (
                        <div className="flex gap-1.5 flex-wrap">
                            {post.dungeon.achievements
                                .filter((a) => post.wantedAchievementIds.includes(a.id))
                                .slice(0, 3)
                                .map((a) => (
                                    <div
                                        key={a.id}
                                        title={a.challenge.name}
                                        className="w-7 h-7 rounded-lg bg-surface/50 border border-border p-1 shrink-0"
                                    >
                                        {a.challenge.iconUrl && (
                                            <img src={a.challenge.iconUrl} alt={a.challenge.name} className="w-full h-full object-contain" />
                                        )}
                                    </div>
                                ))}
                            {post.wantedAchievementIds.length > 3 && (
                                <div className="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center text-caption font-black text-muted-foreground border border-border shadow-inner">
                                    +{post.wantedAchievementIds.length - 3}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Required Classes */}
                    {post.requiredClasses && post.requiredClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {post.requiredClasses.map(c => {
                                const cls = getClass(c);
                                return (
                                    <div key={c} title={c} className="w-7 h-7 rounded-lg bg-background border border-border p-1 overflow-hidden shadow-inner transition-transform ">
                                        {cls ? (
                                            <img src={cls.icon} alt={c} className="w-full h-full object-contain" />
                                        ) : (
                                            <span className="text-caption font-black flex items-center justify-center h-full w-full rounded text-foreground"
                                                style={{ backgroundColor: `hsl(${(c.charCodeAt(0) * 47) % 360}, 55%, 35%)` }}>
                                                {c[0]?.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Multi-donjons : liste des donjons de la session (#26) */}
                    {isMulti && (
                        <div className="space-y-2">
                            {multiDungeons.slice(0, 3).map((d: any, idx: number) => (
                                <div key={d.dungeonId ?? idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background/40 border border-border">
                                    {d.imageUrl ? (
                                        <img src={d.imageUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-background border border-border shrink-0 p-0.5" />
                                    ) : (
                                        <span className="w-9 h-9 rounded-lg bg-background border border-border shrink-0 flex items-center justify-center">
                                            <DofusUiIcon name="dungeon" size={16} className="opacity-60" />
                                        </span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-caption font-bold text-foreground truncate">{d.name}</p>
                                        <p className="text-caption text-muted-foreground">
                                            Lvl {d.level}
                                            {(d.wantedAchievementIds?.length ?? 0) > 0 && ` · ${d.wantedAchievementIds.length} succès`}
                                            {d.targetDate ? ` · ${formatDjDateLabel(d.targetDate, { shortMonth: true }) ?? ""}` : ""}
                                        </p>
                                    </div>
                                    <span className="text-caption font-black text-muted-foreground/70 uppercase tracking-widest shrink-0">#{idx + 1}</span>
                                </div>
                            ))}
                            {multiDungeons.length > 3 && (
                                <p className="text-caption font-bold text-muted-foreground px-1">
                                    + {multiDungeons.length - 3} autres donjons
                                </p>
                            )}
                        </div>
                    )}

                    {/* Quest link & Dungeon Guide Links (DofusDB, Dofuspourlesnoobs, Dofensive) */}
                    <div className="pt-1 flex flex-wrap gap-2">
                        {post.dungeon?.dofuspourlesnoobsUrl && (
                            <a href={post.dungeon.dofuspourlesnoobsUrl} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 text-caption font-bold text-muted-foreground hover:text-foreground bg-background border border-border hover:bg-elevated rounded-xl px-3 py-2 w-max transition-colors duration-200">
                                <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" />
                                Guide DPLN
                            </a>
                        )}
                        {post.dungeon?.dofensiveUrl && (
                            <a href={post.dungeon.dofensiveUrl} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 text-caption font-bold text-muted-foreground hover:text-foreground bg-background border border-border hover:bg-elevated rounded-xl px-3 py-2 w-max transition-colors duration-200">
                                <span className="text-xs">🛡️</span>
                                Dofensive
                            </a>
                        )}
                        {(post.questId && post.questId > 0) || (post.mode === "QUETE" && post.questUrl) ? (
                            <>
                                {post.questId && post.questId > 0 ? (
                                    <a href={`https://dofusdb.fr/fr/database/quest/${post.questId}`} target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-2 text-caption font-bold text-muted-foreground hover:text-foreground bg-background border border-border hover:bg-elevated rounded-xl px-3 py-2 w-max transition-colors duration-200">
                                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="DofusDB" className="w-3.5 h-3.5 rounded-sm" />
                                        {isDonjon && post.questName ? post.questName : "Ouvrir DofusDB"}
                                    </a>
                                ) : post.questUrl && !post.dungeon?.dofuspourlesnoobsUrl && (
                                    <a href={post.questUrl} target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-2 text-caption font-bold text-muted-foreground hover:text-foreground bg-background border border-border hover:bg-elevated rounded-xl px-3 py-2 w-max transition-colors duration-200">
                                        <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" />
                                        DofusPourLesNoobs
                                    </a>
                                )}
                            </>
                        ) : null}
                    </div>

                    {/* Message */}
                    {post.message && (
                        <div className="text-caption text-muted-foreground italic border-l-2 border-border pl-3 py-1.5 line-clamp-2 leading-relaxed">
                            "{post.message}"
                        </div>
                    )}

                    <div className="flex-1" /> {/* Spacer */}

                    {/* Creator Header (pushed to bottom) */}
                    <div className="flex items-center gap-3 pt-4 border-t border-border mt-auto">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-elevated shrink-0 ring-1 ring-white/10">
                            {post.profile.user.image && (
                                <img src={post.profile.user.image} alt="" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <PseudoChip
                            pseudo={post.profile.pseudoDofus || post.profile.discordNickname || "Inconnu"}
                            classe={post.profile.classe}
                            className="min-w-0 flex-1 text-caption font-black text-muted-foreground tracking-tight"
                        />
                        {isOwner && <DofusUiIcon name="leader" size={12} className="opacity-80" />}
                        <span className="flex items-center gap-1 shrink-0 text-caption font-bold uppercase tracking-tighter text-muted-foreground">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDistanceToNow(new Date(post.createdAt), { locale: fr, addSuffix: true })}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                        {post.isDiscordPublished && post.discordMessageId && post.discordChannelId && (
                            <a
                                href={`https://discord.com/channels/${guildId}/${post.discordChannelId}/${post.discordMessageId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#5865F2]/10 hover:bg-[#5865F2] border border-[#5865F2]/20 text-foreground hover:text-white transition-colors shrink-0"
                                title="Voir sur Discord"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.966 2.419-2.156 2.419m7.974 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.946 2.419-2.156 2.419"/>
                                </svg>
                            </a>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsDetailOpen(true)}
                            className="flex-1 min-w-[92px] h-10 text-xs font-bold uppercase tracking-wide whitespace-nowrap bg-surface/40 border border-border text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                        >
                            Détails
                        </Button>

                        {(post.status === "OPEN" || post.status === "FULL") && !isOwner && !myParticipation && (
                            <Button
                                size="sm"
                                onClick={() => setIsDetailOpen(true)}
                                disabled={isPending}
                                className={cn(
                                    "flex-1 min-w-[110px] h-10 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors",
                                    post.status === "FULL"
                                        ? "bg-surface/50 text-foreground border border-border-strong hover:bg-elevated"
                                        : "bg-info/15 text-info border border-info/30 hover:bg-info hover:text-info-foreground"
                                )}
                            >
                                <LogIn className="w-4 h-4 mr-2" />
                                {post.status === "FULL" ? "File d'attente" : "Rejoindre"}
                            </Button>
                        )}

                        {myParticipation && myParticipation.status === "PENDING" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLeave}
                                disabled={isPending}
                                className="flex-1 min-w-[110px] h-10 text-xs font-bold uppercase tracking-wide whitespace-nowrap border-danger/30 text-danger hover:text-danger-foreground hover:bg-danger transition-colors"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Annuler
                            </Button>
                        )}

                        {myParticipation?.status === "ACCEPTED" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLeave}
                                disabled={isPending}
                                className="flex-1 min-w-[110px] h-10 text-xs font-bold uppercase tracking-wide whitespace-nowrap border-danger/30 text-danger hover:text-danger-foreground hover:bg-danger transition-colors"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Se retirer
                            </Button>
                        )}

                        {myParticipation?.status === "REJECTED" && (
                            <div className="flex-1 min-w-[110px] flex items-center justify-center h-10 rounded-xl bg-danger/10 text-danger border border-danger/30 font-bold text-xs uppercase tracking-wide whitespace-nowrap">
                                <XCircle className="w-4 h-4 mr-2" /> Refusé
                            </div>
                        )}

                        {/* Clôture DIRECTE depuis la carte : c'est l'action utile du créateur
                            (bilan des succès + points + clôture Discord). L'ancien menu « … »
                            cachait « Terminer » derrière un dropdown, et « Supprimer le groupe »
                            n'existe plus (la suppression détruisait le bilan sans rien apporter :
                            les posts inactifs sont déjà purgés par le cron). */}
                        {(isOwner || (isAdmin && !isOwner)) && (post.status === "OPEN" || post.status === "FULL") && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsCloseModalOpen(true)}
                                disabled={isPending}
                                title={isOwner ? "Terminer le post (bilan + clôture Discord)" : "Fermer le post (admin)"}
                                className="flex-1 min-w-[110px] h-10 text-xs font-bold uppercase tracking-wide whitespace-nowrap bg-info/15 text-info border border-info/30 hover:bg-info hover:text-info-foreground transition-colors"
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                {isOwner ? "Terminer" : "Fermer"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <DjPostDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                post={post}
                guildId={guildId}
                currentProfileId={currentProfileId}
                isAdmin={isAdmin}
                onRefresh={onRefresh}
            />

            {(isOwner || (isAdmin && !isOwner)) && (
                <DjCloseModal
                    isOpen={isCloseModalOpen}
                    post={post}
                    guildId={guildId}
                    adminMode={isAdmin && !isOwner}
                    onClose={() => setIsCloseModalOpen(false)}
                    onClosed={onRefresh}
                />
            )}
        </>
    );
}
