"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Users, Clock,
    XCircle, LogIn, LogOut, CheckCircle2, Pause
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClassIcon } from "@/components/shared/class-icon";
import { AchievementIcon } from "@/components/ui/achievement-icon";
import { DofusUiIcon, type DofusUiIconName } from "@/components/shared/dofus-ui-icon";
import { PseudoChip } from "@/components/shared/pseudo-chip";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
import { DiscordIcon } from "@/components/shared/icons";
import { leaveDjPost } from "@/server/actions/dungeon-finder-actions";
import { DjPostDetailModal } from "./DjPostDetailModal";
import { DjCloseModal } from "./DjCloseModal";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getClass } from "@/lib/dofus-assets";
import { getMultiDungeons, getDjPostTitle, getDjPostSubtitle, formatDjDateLabel, getDjDungeonStats, summarizeDjDungeons } from "@/lib/dungeon-finder-utils";
import { isStandByActive, standByAuthorName } from "@/lib/group-standby";
import { dungeonFicheHref } from "@/lib/dungeon-fiche";
import { DjMultiBossAvatars } from "./DjMultiBossAvatars";

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const MODE_META: Record<string, { label: string; asset: DofusUiIconName }> = {
    DONJON: { label: "Donjon", asset: "dungeon" },
    QUETE: { label: "Quête", asset: "quest" },
    DEFI: { label: "Défi", asset: "challenge" },
};

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

    // Une seule règle de comptage (#203) : en multi, les places sont **par donjon**.
    // Le ratio global (`1/4`) annonçait 3 places alors que les 5 groupes pouvaient être pleins.
    const stats = getDjDungeonStats(post);
    const summary = summarizeDjDungeons(stats);
    const spotsLeft = summary.maxSpots;

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

    const isOpen = post.status === "OPEN" || post.status === "FULL";
    const isDonjon = post.mode === "DONJON";

    return (
        <>
            <div
                className={cn(
                    "cv-auto group relative rounded-xl border font-sans overflow-hidden transition-colors duration-150 flex flex-col justify-between p-4 space-y-3.5",
                    isOpen
                        ? "bg-surface/50 text-foreground border-border hover:border-border-strong hover:bg-surface/70"
                        : "bg-surface/20 text-muted-foreground border-border/50 opacity-60 grayscale-[30%]"
                )}
            >
                {/* 1. Header du post : Boss/Quête + Titre + Badge Statut */}
                <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                            "w-12 h-12 rounded-xl bg-surface/80 border border-border flex items-center justify-center overflow-hidden shrink-0 p-1 transition-colors",
                            isOpen ? "group-hover:border-border-strong" : ""
                        )}>
                            {isMulti ? (
                                <DjMultiBossAvatars dungeons={multiDungeons} />
                            ) : coverImage ? (
                                <img
                                    src={coverImage}
                                    alt={subtitle}
                                    className="w-full h-full object-contain drop-shadow"
                                />
                            ) : (
                                <DofusUiIcon name={modeMeta.asset} size={24} className="opacity-80" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <h3
                                    className="text-sm font-bold text-foreground tracking-tight leading-snug line-clamp-2"
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
                            <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wide truncate mt-0.5">
                                {subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Statut : un seul accent sémantique (success / warning / muted). */}
                    {isOpen ? (
                        post.status === "FULL" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-border text-warning shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                                {statusMeta.label}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-border text-success shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                {statusMeta.label}
                            </span>
                        )
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted/40 border border-border text-muted-foreground shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                            {statusMeta.label}
                        </span>
                    )}
                </div>

                {/* 2. Badges Mode & Places */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-surface/70 border border-border/60 text-foreground">
                            <DofusUiIcon name={modeMeta.asset} size={13} className="opacity-80" />
                            <span>{modeMeta.label}</span>
                        </span>

                        {/* Stand-by (30/10/2026) : un post gelé doit se voir DANS LA LISTE —
                            sinon il paraît actif alors que le cron ne pinge plus. */}
                        {isStandByActive(post.standBy) && (
                            <span
                                className="inline-flex items-center gap-1.5 text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-surface/70 border border-border/60 text-muted-foreground"
                                title={standByAuthorName(post.standBy) ? `Mis en stand-by par ${standByAuthorName(post.standBy)}` : "En stand-by"}
                            >
                                <Pause className="w-3.5 h-3.5" />
                                Stand-by
                            </span>
                        )}
                    </div>

                    <span
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-surface/70 border border-border/60 px-2.5 py-1 rounded-lg"
                        title={isMulti ? summary.label : undefined}
                    >
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <strong className="text-foreground">{isMulti ? `${stats.length} donjons` : summary.label}</strong>
                        {summary.allFull ? (
                            <span className="text-warning font-semibold">Plein{isMulti ? " partout" : ""}</span>
                        ) : (
                            <span className="text-success font-semibold">+{spotsLeft}{isMulti ? " max" : ""}</span>
                        )}
                    </span>
                </div>

                {/* 3. Date et Heure de la sortie */}
                {post.targetDate && (
                    <div className="rounded-lg border border-border/60 bg-surface/30 px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                        <DofusUiIcon name="date" size={14} className={cn("shrink-0", !isOpen && "opacity-60")} />
                        <span className={cn(
                            "font-semibold uppercase tracking-tight truncate",
                            isOpen ? "text-foreground" : "text-muted-foreground"
                        )}>
                            {formatDjDateLabel(post.targetDate, { shortWeekday: true }) ?? ""}
                        </span>
                    </div>
                )}

                {/* 4. Avatars des membres inscrits avec badges de classe */}
                <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                    <div className="flex items-center -space-x-2 overflow-hidden py-1">
                        {/* Leader */}
                        <div key={post.profileId} className="relative group/avatar animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none" title={`${post.profile.pseudoDofus || post.profile.discordNickname} (LEAD)`}>
                            <Avatar className="h-8 w-8 ring-2 ring-success/40 transition-all border-2 border-surface bg-elevated">
                                <DiscordAvatarImage src={post.profile.user.image || undefined} />
                                <AvatarFallback className="bg-elevated text-foreground text-[10px] font-bold">
                                    {(post.profile.pseudoDofus || post.profile.discordNickname || "??").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-surface bg-background p-[2px]">
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
                                <Avatar className="h-8 w-8 ring-1 ring-border/70 border-2 border-surface bg-elevated shadow-md">
                                    <DiscordAvatarImage src={p.profile.user.image || undefined} />
                                    <AvatarFallback className="bg-elevated text-muted-foreground text-[10px] font-bold">
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
                        {Array.from({ length: Math.max(0, Math.min(spotsLeft, 6)) }).map((_, i) => (
                            <div
                                key={`empty-${i}`}
                                className="w-8 h-8 rounded-full border border-dashed border-success/25 flex items-center justify-center text-[10px] text-success/60 font-mono select-none transition-colors hover:border-success/40 hover:text-success"
                                title="Place libre"
                            >
                                +
                            </div>
                        ))}
                    </div>

                    {/* Waitlist pill if any pending */}
                    {post.participants.filter((p) => p.status === "PENDING").length > 0 && (
                        <div
                            className="flex items-center gap-1.5 rounded-full border border-warning/30 px-2.5 py-0.5 text-[11px] text-warning"
                            title="Joueurs en file d'attente"
                        >
                            <DofusUiIcon name="hourglass" size={11} />
                            <span>{post.participants.filter((p) => p.status === "PENDING").length} en attente</span>
                        </div>
                    )}
                </div>

                {/* Succès visés */}
                {post.wantedAchievementIds.length > 0 && post.dungeon && (
                    <div className="flex gap-1.5 flex-wrap pt-0.5">
                        {post.dungeon.achievements
                            .filter((a) => post.wantedAchievementIds.includes(a.id))
                            .slice(0, 4)
                            .map((a) => (
                                <div
                                    key={a.id}
                                    title={a.challenge.name}
                                    className="w-6 h-6 rounded-md bg-surface border border-border p-0.5 shrink-0 hover:border-success/40 transition-colors"
                                >
                                    <AchievementIcon
                                        iconUrl={a.challenge.iconUrl}
                                        slug={a.challenge.slug ?? null}
                                        label={a.challenge.name}
                                        size={20}
                                    />
                                </div>
                            ))}
                        {post.wantedAchievementIds.length > 4 && (
                            <div className="w-6 h-6 rounded-md bg-elevated flex items-center justify-center text-[10px] font-bold text-muted-foreground border border-border">
                                +{post.wantedAchievementIds.length - 4}
                            </div>
                        )}
                    </div>
                )}

                {/* Classes recherchées */}
                {post.requiredClasses && post.requiredClasses.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[11px] font-mono text-muted-foreground">Recherche :</span>
                        {post.requiredClasses.map((c) => {
                            const cls = getClass(c);
                            return (
                                <div key={c} title={c} className="w-6 h-6 rounded-md bg-background border border-border p-0.5 overflow-hidden shadow-inner">
                                    {cls ? (
                                        <img src={cls.icon} alt={c} className="w-full h-full object-contain" />
                                    ) : (
                                        <span
                                            className="text-[10px] font-bold flex items-center justify-center h-full w-full rounded text-foreground"
                                            style={{ backgroundColor: `hsl(${(c.charCodeAt(0) * 47) % 360}, 55%, 35%)` }}
                                        >
                                            {c[0]?.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Multi-donjons (#26) */}
                {isMulti && (
                    <div className="space-y-1.5 pt-1">
                        {multiDungeons.slice(0, 2).map((d: any, idx: number) => (
                            <div key={d.dungeonId ?? idx} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/80">
                                {d.imageUrl ? (
                                    <img src={d.imageUrl} alt="" className="w-7 h-7 rounded-md object-contain bg-background border border-border shrink-0 p-0.5" />
                                ) : (
                                    <span className="w-7 h-7 rounded-md bg-background border border-border shrink-0 flex items-center justify-center">
                                        <DofusUiIcon name="dungeon" size={14} className="opacity-60" />
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-foreground truncate">{d.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                        Lvl {d.level}
                                        {(d.wantedAchievementIds?.length ?? 0) > 0 && ` · ${d.wantedAchievementIds.length} succès`}
                                    </p>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{idx + 1}</span>
                            </div>
                        ))}
                        {multiDungeons.length > 2 && (
                            <p className="text-[11px] font-mono text-muted-foreground px-1">
                                + {multiDungeons.length - 2} autres donjons
                            </p>
                        )}
                    </div>
                )}

                {/* Liens externes compacts */}
                {(() => {
                    const ficheHref = dungeonFicheHref(guildId, post.dungeon);
                    const hasDpln = Boolean(post.dungeon?.dofuspourlesnoobsUrl);
                    const hasDb = Boolean((post.questId && post.questId > 0) || (post.mode === "QUETE" && post.questUrl));
                    if (!ficheHref && !hasDpln && !hasDb) return null;

                    return (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {ficheHref && (
                                <a
                                    href={ficheHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-muted-foreground hover:text-success bg-surface/50 hover:bg-surface/80 border border-border/70 hover:border-success/40 rounded-lg px-2.5 py-1 transition-colors"
                                >
                                    <img src="/assets/ui/logo-v2.png" alt="SigilOS" className="w-3.5 h-3.5 rounded-sm object-contain" />
                                    <span>Fiche SigilOS</span>
                                </a>
                            )}
                            {post.dungeon?.dofuspourlesnoobsUrl && (
                                <a
                                    href={post.dungeon.dofuspourlesnoobsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-muted-foreground hover:text-foreground bg-surface/50 hover:bg-surface/80 border border-border/70 hover:border-border-strong rounded-lg px-2.5 py-1 transition-all"
                                >
                                    <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" />
                                    <span>Guide DPLN</span>
                                </a>
                            )}
                            {post.questId && post.questId > 0 ? (
                                <a
                                    href={`https://dofusdb.fr/fr/database/quest/${post.questId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-muted-foreground hover:text-success bg-surface/50 hover:bg-surface/80 border border-border/70 hover:border-success/30 rounded-lg px-2.5 py-1 transition-all"
                                >
                                    <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="DofusDB" className="w-3.5 h-3.5 rounded-sm" />
                                    <span>{isDonjon && post.questName ? post.questName : "DofusDB"}</span>
                                </a>
                            ) : post.questUrl && !post.dungeon?.dofuspourlesnoobsUrl ? (
                                <a
                                    href={post.questUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-muted-foreground hover:text-foreground bg-surface/50 hover:bg-surface/80 border border-border/70 hover:border-border-strong rounded-lg px-2.5 py-1 transition-all"
                                >
                                    <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" />
                                    <span>DPLN</span>
                                </a>
                            ) : null}
                        </div>
                    );
                })()}

                {/* 5. Message du meneur de groupe */}
                {post.message && (
                    <div className="rounded-xl border border-border/60 bg-surface/30 p-2.5 text-xs text-muted-foreground italic leading-relaxed line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere] break-all">
                        &ldquo;{post.message}&rdquo;
                    </div>
                )}

                {/* 6. Footer : Créateur et Actions */}
                <div className="pt-3 border-t border-border/60 mt-auto space-y-2.5">
                    {/* Créateur & Date */}
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-elevated shrink-0 ring-1 ring-border/70">
                                {post.profile.user.image && (
                                    <img src={post.profile.user.image} alt="" className="w-full h-full object-cover" />
                                )}
                            </div>
                            <PseudoChip
                                pseudo={post.profile.pseudoDofus || post.profile.discordNickname || "Inconnu"}
                                classe={post.profile.classe}
                                className="min-w-0 truncate font-semibold text-foreground text-xs"
                            />
                            {isOwner && <DofusUiIcon name="leader" size={12} className="opacity-80 shrink-0" />}
                        </div>
                        <span className="text-[10px] font-mono opacity-60 shrink-0 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDistanceToNow(new Date(post.createdAt), { locale: fr, addSuffix: true })}
                        </span>
                    </div>

                    {/* Barre d'actions */}
                    <div className="flex items-center gap-2 pt-0.5">
                        {post.isDiscordPublished && post.discordMessageId && post.discordChannelId && (
                            <a
                                href={`https://discord.com/channels/${guildId}/${post.discordChannelId}/${post.discordMessageId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 rounded-lg bg-surface/50 hover:bg-[#5865F2]/20 border border-border/70 hover:border-[#5865F2]/40 text-muted-foreground hover:text-[#5865F2] transition-colors shrink-0"
                                title="Voir sur Discord"
                            >
                                <DiscordIcon className="w-3.5 h-3.5" />
                            </a>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsDetailOpen(true)}
                            className="flex-1 h-8 rounded-lg bg-surface/50 hover:bg-surface/80 border border-border/70 text-xs font-semibold text-foreground transition-colors cursor-pointer"
                        >
                            Détails
                        </Button>

                        {/* CTA Rejoindre / File d'attente / Se retirer / Annuler / Terminer */}
                        {(post.status === "OPEN" || post.status === "FULL") && !isOwner && !myParticipation && (
                            <Button
                                size="sm"
                                onClick={() => setIsDetailOpen(true)}
                                disabled={isPending}
                                className={cn(
                                    "flex-1 h-8 rounded-lg text-xs font-bold transition-all inline-flex items-center justify-center gap-1 cursor-pointer",
                                    post.status === "FULL"
                                        ? "bg-surface hover:bg-elevated text-foreground border border-border-strong"
                                        : "bg-accent hover:bg-accent/90 text-accent-foreground border border-accent/40 "
                                )}
                            >
                                <LogIn className="w-3 h-3 mr-1" />
                                {post.status === "FULL" ? "File d'attente" : "Rejoindre"}
                            </Button>
                        )}

                        {myParticipation && myParticipation.status === "PENDING" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLeave}
                                disabled={isPending}
                                className="flex-1 h-8 rounded-lg text-xs font-bold border-danger/30 text-danger hover:text-danger-foreground hover:bg-danger transition-colors inline-flex items-center justify-center gap-1"
                            >
                                <LogOut className="w-3 h-3 mr-1" />
                                Annuler
                            </Button>
                        )}

                        {myParticipation?.status === "ACCEPTED" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLeave}
                                disabled={isPending}
                                className="flex-1 h-8 rounded-lg text-xs font-bold border-danger/30 text-danger hover:text-danger-foreground hover:bg-danger transition-colors inline-flex items-center justify-center gap-1"
                            >
                                <LogOut className="w-3 h-3 mr-1" />
                                Se retirer
                            </Button>
                        )}

                        {myParticipation?.status === "REJECTED" && (
                            <div className="flex-1 h-8 flex items-center justify-center rounded-lg bg-danger/10 text-danger border border-danger/30 font-bold text-xs uppercase tracking-wide">
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Refusé
                            </div>
                        )}

                        {/* Owner : Bouton Terminer direct dans les actions */}
                        {isOwner && (post.status === "OPEN" || post.status === "FULL") && (
                            <Button
                                size="sm"
                                onClick={() => setIsCloseModalOpen(true)}
                                disabled={isPending}
                                title="Terminer le post (bilan + clôture Discord)"
                                className="flex-1 h-8 rounded-lg text-success border border-success/30 hover:border-success/50 text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Terminer
                            </Button>
                        )}

                        {/* Admin (non owner) : Action discrète de fermeture */}
                        {isAdmin && !isOwner && (post.status === "OPEN" || post.status === "FULL") && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsCloseModalOpen(true)}
                                disabled={isPending}
                                title="Fermer le post (admin)"
                                className="h-8 px-2.5 rounded-lg border-border hover:border-danger/40 hover:bg-danger/10 text-muted-foreground hover:text-danger text-xs font-bold transition-colors"
                            >
                                <XCircle className="w-3.5 h-3.5" />
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
