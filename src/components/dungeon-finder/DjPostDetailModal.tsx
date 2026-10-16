"use client";

import { cn } from "@/lib/utils";
import { getAchievementIconUrl } from "@/lib/achievement-icon";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
    Users, CheckCircle2, Swords, Map, Zap, LogIn, LogOut, Trash2, Pencil, Bell, Layers, AlarmClock, ChevronDown,
} from "lucide-react";
import {
    acceptDjParticipant,
    rejectDjParticipant,
    joinDjPost,
    leaveDjPost,
    republishDjMultiLayout,
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
import { getMultiDungeons, getDjPostTitle, getDjPostSubtitle, formatDjDateLabel, getDjDungeonStats, summarizeDjDungeons, getMultiMessageIds } from "@/lib/dungeon-finder-utils";
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
    /**
     * #26 — donjons **visés** par la candidature (cases à cocher). Vide par défaut : on ne
     * devine jamais la sélection à la place du joueur (l'ancien formulaire inscrivait
     * « global », donc dans **tous** les donjons — constat du 16/10/2026).
     */
    const [targets, setTargets] = useState<number[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
    // Clôture (bilan des succès/points + fermeture Discord) : action principale du
    // créateur. La suppression du groupe a été retirée (elle détruisait le bilan).
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    /**
     * #26 — accordéon « un bloc par donjon » : le premier est déplié d'office (on voit
     * tout de suite où on en est), les autres s'ouvrent à la demande. Responsive par
     * construction : un seul niveau de pliage, aucune colonne fixe.
     */
    const [openDungeons, setOpenDungeons] = useState<number[]>([0]);
    const toggleDungeonOpen = (index: number) =>
        setOpenDungeons((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
    const [isPending, startTransition] = useTransition();

    const isOwner = post.profileId === currentProfileId;

    // Multi-donjons
    const multiDungeons = getMultiDungeons(post.dungeonsJson);
    const isMulti = multiDungeons.length > 0;
    const postTitle = getDjPostTitle(post);
    const postSubtitle = getDjPostSubtitle(post);

    /**
     * **Une seule** règle de comptage des places (#203) : par donjon en multi, globale sur
     * un post simple. Avant, cet écran affichait un ratio global sur un post de 5 donjons
     * alors que Discord comptait donjon par donjon.
     */
    const stats = getDjDungeonStats(post);
    const summary = summarizeDjDungeons(stats);
    /**
     * Le post est-il **déjà** au format « un message par donjon » (un id par donjon) ?
     * Sert à n'afficher le bouton de republication que lorsqu'il a quelque chose à faire
     * (post hérité, ou message de donjon manquant) — jamais comme un réglage permanent.
     */
    const hasPerDungeonLayout = isMulti
        && getMultiMessageIds(post.dungeonsJson).length === multiDungeons.length;
    /** Mes inscriptions — **plusieurs** possibles sur un post multi (une par donjon). */
    const myParticipations = currentProfileId
        ? post.participants.filter((p) => p.profile.id === currentProfileId)
        : [];
    const myIndexes = myParticipations.map((p) => p.dungeonIndex ?? -1);
    /** Inscriptions « sans donjon » (créées avant la reprise) : elles ne visent aucun donjon. */
    const myLegacy = myParticipations.filter((p) => p.dungeonIndex == null);
    const isJoinablePost = post.status === "OPEN" || post.status === "FULL";
    /** Donjons que je peux encore rejoindre (jamais deux fois le même). */
    const joinable = stats.filter((s) => !myIndexes.includes(s.index));
    const canJoin = isJoinablePost && !isOwner && (isMulti ? joinable.length > 0 : myParticipations.length === 0);
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

    const acceptedParticipants = post.participants.filter((p) => p.status === "ACCEPTED");
    const pendingParticipants = post.participants.filter((p) => p.status === "PENDING");

    /** Places restantes du groupe d'un inscrit (par donjon en multi, #203). */
    const spotsLeftFor = (dungeonIndex?: number | null): number =>
        (stats.find((s) => s.index === (dungeonIndex ?? -1)) ?? stats[0])?.spotsLeft ?? 0;

    /** Coche / décoche un donjon dans la candidature (jamais une inscription immédiate). */
    const toggleTarget = (index: number) =>
        setTargets((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)));

    /** Les groupes visés sont-ils **tous** complets (⇒ file d'attente) ? */
    const targetsAllFull = isMulti
        ? targets.length > 0 && targets.every((i) => stats.find((s) => s.index === i)?.isFull)
        : (stats[0]?.spotsLeft ?? 0) <= 0;

    // #179 — la copie des pseudos est UNITAIRE (voir `PseudoChip`) : plus de bouton
    // global qui collait toute la liste `\n/w Pseudo`.

    function handleJoin() {
        startTransition(async () => {
            const res = await joinDjPost(guildId, post.id, {
                classe: classe || null,
                message: message || null,
                // Post multi : les donjons cochés. Post simple : aucun index (un seul groupe).
                dungeonIndexes: isMulti ? targets : null,
            });
            if (res.success) {
                const data = (res as { data?: { joined?: number; waitlistedCount?: number } }).data;
                const joinedCount = data?.joined ?? 0;
                const waiting = data?.waitlistedCount ?? 0;
                toast.success(joinedCount > 0
                    ? `Candidature envoyée${joinedCount > 1 ? ` — ${joinedCount} donjons` : ""} !`
                    : `Place en file d'attente${waiting > 1 ? ` (${waiting} donjons)` : ""} !`
                );
                onRefresh();
                onClose();
            } else {
                toast.error(res.error);
            }
        });
    }

    /** Quitter **un** groupe précis — jamais « la première participation » du post. */
    function handleLeave(dungeonIndex: number | null) {
        startTransition(async () => {
            const res = await leaveDjPost(guildId, post.id, dungeonIndex);
            if (res.success) { toast.success("Inscription retirée."); onRefresh(); }
            else toast.error(res.error);
        });
    }

    /** Republier le post **déjà en ligne** au format « un message par donjon » (#26). */
    function handleRepublishLayout() {
        startTransition(async () => {
            const res = await republishDjMultiLayout(guildId, post.id);
            if (res.success) {
                toast.success("Post Discord republié — un message par donjon.");
                onRefresh();
            } else {
                toast.error(res.error);
            }
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
                                <p className="text-muted-foreground text-caption uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><DofusUiIcon name="player" size={13} /> {isMulti ? "Places (par donjon)" : "Places"}</p>
                                <p className="font-bold text-foreground text-sm">
                                    {isMulti ? (
                                        summary.allFull
                                            ? <span className="text-amber-400 font-mono">Complet partout</span>
                                            : <span className="text-emerald-400 font-mono font-medium">{summary.label}</span>
                                    ) : (
                                        <>
                                            {summary.label} — {stats[0].spotsLeft > 0 ? <span className="text-emerald-400 font-mono font-medium">{`${stats[0].spotsLeft} dispo${stats[0].spotsLeft > 1 ? "s" : ""}`}</span> : <span className="text-amber-400 font-mono">Complet</span>}
                                        </>
                                    )}
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
                                {stats.map((s) => {
                                    const d = multiDungeons[s.index];
                                    const myRow = myParticipations.find((p) => (p.dungeonIndex ?? -1) === s.index);
                                    const ticked = targets.includes(s.index);
                                    const classesForDungeon: string[] = (d?.requiredClasses?.length ? d.requiredClasses : (post.requiredClasses ?? []));
                                    const open = openDungeons.includes(s.index);
                                    return (
                                    <div key={d?.dungeonId ?? s.index} className="rounded-xl bg-surface/50 border border-border/70 overflow-hidden">
                                        {/* En-tête toujours visible (nom, places) : cliquer replie/déplie. */}
                                        <button type="button" onClick={() => toggleDungeonOpen(s.index)}
                                            className="w-full flex items-center gap-2.5 p-2.5 text-left hover:bg-surface/70 transition-colors">
                                            {d?.imageUrl ? (
                                                <img src={d.imageUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-background border border-border/70 shrink-0 p-0.5" />
                                            ) : (
                                                <span className="w-9 h-9 rounded-lg bg-background border border-border/70 shrink-0 flex items-center justify-center text-muted-foreground">
                                                    <Swords className="w-4 h-4" />
                                                </span>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-foreground truncate">{d?.name}</p>
                                                <p className="text-caption text-muted-foreground font-mono">
                                                    Lvl {d?.level}
                                                    {(d?.wantedAchievementIds?.length ?? 0) > 0 && ` · ${d!.wantedAchievementIds!.length} succès`}
                                                    {classesForDungeon.length > 0 && ` · ${classesForDungeon.length} classe${classesForDungeon.length > 1 ? "s" : ""}`}
                                                    {d?.targetDate ? ` · ${formatDjDateLabel(d.targetDate, { shortMonth: true }) ?? ""}` : ""}
                                                </p>
                                            </div>
                                            <span className={cn(
                                                "text-caption font-mono font-bold shrink-0 px-2 py-1 rounded-lg border",
                                                s.isFull
                                                    ? "text-amber-400 border-amber-500/30 bg-amber-950/30"
                                                    : "text-emerald-400 border-emerald-500/30 bg-emerald-950/30"
                                            )}>
                                                {s.acceptedCount}/{s.maxMembers}
                                            </span>
                                            <span className="text-caption font-mono font-bold text-muted-foreground uppercase tracking-wider shrink-0">#{s.index + 1}</span>
                                            <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                                        </button>
                                        {open && (
                                        <div className="px-2.5 pb-2.5 space-y-2.5">
                                            {/* Classes recherchées de CE donjon (#26) */}
                                            {classesForDungeon.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-caption uppercase tracking-widest font-bold text-muted-foreground">Classes recherchées</p>
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {classesForDungeon.map((c) => {
                                                            const classData = getClass(c);
                                                            return (
                                                                <span key={c} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-lg bg-surface/70 border border-border/70 text-caption font-semibold text-foreground">
                                                                    {classData?.icon && (
                                                                        <img src={classData.icon} alt="" className="w-4 h-4 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                                                    )}
                                                                    {classData?.name || c}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Note de CE donjon (dungeonsJson[].message) */}
                                            {d?.message && (
                                                <p className="text-caption text-foreground italic bg-surface/60 border border-border/60 rounded-lg px-2.5 py-2 break-words [overflow-wrap:anywhere]">
                                                    &ldquo;{d.message}&rdquo;
                                                </p>
                                            )}

                                            {/* Succès visés de CE donjon (snapshot du post) */}
                                            {(d?.wantedAchievementIds?.length ?? 0) > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-caption uppercase tracking-widest font-bold text-muted-foreground">Succès visés</p>
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {(d!.achievements ?? [])
                                                            .filter((a) => d!.wantedAchievementIds!.includes(a.id))
                                                            .map((a) => (
                                                                <span key={a.id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-lg bg-surface/70 border border-border/70 text-caption font-semibold text-foreground">
                                                                    {a.iconUrl && (
                                                                        <img src={getAchievementIconUrl(null, a.iconUrl) ?? undefined} alt="" className="w-4 h-4 object-contain" />
                                                                    )}
                                                                    {a.name}
                                                                </span>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Roster de CE donjon : créateur + inscrits, puis la file (actions par personne) */}
                                            <div className="space-y-1.5">
                                                <p className="text-caption uppercase tracking-widest font-bold text-muted-foreground">
                                                    Inscrits ({s.acceptedCount}/{s.maxMembers})
                                                </p>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <span className="text-caption font-semibold text-foreground">{displayName(post.profile)}</span>
                                                    <span className="text-caption text-muted-foreground">créateur</span>
                                                    {s.accepted.map((p) => (
                                                        <PseudoChip key={p.id} pseudo={displayName(p.profile)} classe={p.classe} className="text-caption font-semibold text-foreground" />
                                                    ))}
                                                    {s.accepted.length === 0 && (
                                                        <span className="text-caption text-muted-foreground italic">personne d&apos;autre pour l&apos;instant</span>
                                                    )}
                                                </div>
                                                {s.pending.length > 0 && (
                                                    <div className="space-y-1">
                                                        <p className="text-caption font-mono text-amber-400 flex items-center gap-1">
                                                            <AlarmClock className="w-3 h-3" /> En attente ({s.pending.length})
                                                        </p>
                                                        {s.pending.map((p) => (
                                                            <div key={p.id} className="flex items-center justify-between gap-2 bg-surface/40 rounded-lg px-2 py-1.5 border border-border/60">
                                                                <PseudoChip pseudo={displayName(p.profile)} classe={p.classe} className="text-caption font-semibold text-foreground min-w-0 truncate" />
                                                                {(isOwner || isAdmin) && post.status === "OPEN" && (
                                                                    <div className="flex gap-1 shrink-0">
                                                                        {s.spotsLeft > 0 && (
                                                                            <Button size="icon" variant="ghost"
                                                                                className="w-7 h-7 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-md"
                                                                                onClick={() => handleAccept(p.id)} disabled={isPending}
                                                                                title="Accepter dans ce donjon">
                                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        )}
                                                                        <Button size="icon" variant="ghost"
                                                                            className="w-7 h-7 text-danger hover:bg-danger/20 hover:text-danger rounded-md"
                                                                            onClick={() => handleReject(p.id)} disabled={isPending}
                                                                            title="Refuser">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        {!isOwner && isJoinablePost && (
                                            myRow ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-caption font-mono font-semibold border",
                                                        myRow.status === "ACCEPTED"
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                            : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                                    )}>
                                                        {myRow.status === "ACCEPTED" ? "Inscrit" : "En file d'attente"}
                                                    </span>
                                                    <Button size="sm" variant="outline"
                                                        className="h-8 px-2.5 text-xs font-bold rounded-lg border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger"
                                                        onClick={() => handleLeave(s.index)} disabled={isPending}>
                                                        <LogOut className="w-3.5 h-3.5 mr-1" /> Se désinscrire
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="outline"
                                                    className={cn(
                                                        "h-8 px-2.5 text-xs font-bold rounded-lg",
                                                        ticked
                                                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                                            : "border-border/70 bg-surface/80 text-foreground hover:bg-surface"
                                                    )}
                                                    onClick={() => toggleTarget(s.index)} disabled={isPending}>
                                                    {ticked ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <LogIn className="w-3.5 h-3.5 mr-1" />}
                                                    {ticked ? "Donjon visé" : "Rejoindre ce donjon"}
                                                </Button>
                                            )
                                        )}
                                        </div>
                                        )}
                                    </div>
                                    );
                                })}

                                {/* Inscriptions « sans donjon » (antérieures à la reprise #26) :
                                    visibles et résiliables, jamais silencieuses. */}
                                {myLegacy.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                                        <span className="text-caption text-amber-400 font-semibold">
                                            {`Ton inscription « sans donjon » (${myLegacy.length}) n'est rattachée à aucun donjon précis.`}
                                        </span>
                                        <Button size="sm" variant="outline"
                                            className="h-8 px-2.5 text-xs font-bold rounded-lg border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger"
                                            onClick={() => handleLeave(null)} disabled={isPending}>
                                            <LogOut className="w-3.5 h-3.5 mr-1" /> Se désinscrire
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Message — post simple (en multi, la note vit **dans** son donjon) */}
                        {!isMulti && post.message && (
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
                                                    <img src={getAchievementIconUrl(null, a.challenge.iconUrl) ?? undefined} alt="" className="w-4 h-4 object-contain" />
                                                )}
                                                <span className="text-xs text-foreground font-semibold">{a.challenge.name}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Required classes */}
                        {/* Classes demandées — post simple (en multi, elles sont **par donjon**) */}
                        {!isMulti && post.requiredClasses && post.requiredClasses.length > 0 && (
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

                        {/* Participants list — posts **simples** uniquement : en multi, chaque
                            donjon a son roster (inscrits, file, actions) dans l'accordéon ci-dessus. */}
                        {!isMulti && (
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-2.5">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" /> Participants {isMulti ? "· par donjon" : `(${summary.label})`}
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
                                                    {isMulti && (p.dungeonIndex != null && multiDungeons[p.dungeonIndex]?.name ? (
                                                        <Badge variant="outline" className="text-caption h-4 border-border/60 text-muted-foreground px-1.5 max-w-[120px] truncate">
                                                            {multiDungeons[p.dungeonIndex].name}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-caption h-4 border-amber-500/40 text-amber-400 px-1.5">
                                                            Sans donjon
                                                        </Badge>
                                                    ))}
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
                                                    onClick={() => handleLeave(p.dungeonIndex ?? null)} disabled={isPending}
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
                                                            {spotsLeftFor(p.dungeonIndex) > 0 && (
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
                        )}

                        {/* Candidature — post multi : on **coche les donjons visés** (jamais un
                            « global » invisible) ; post simple : un seul groupe, comme avant. */}
                        {canJoin && (
                            <div className="border-t border-border/70 pt-6 space-y-4">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">
                                    {isMulti
                                        ? `Candidature${targets.length > 0 ? ` — ${targets.length} donjon${targets.length > 1 ? "s" : ""} visé${targets.length > 1 ? "s" : ""}` : ""}`
                                        : stats[0].spotsLeft > 0 ? "Candidature" : "Rejoindre la file d'attente"}
                                </p>
                                {isMulti && (
                                    <div className="bg-surface/50 rounded-xl p-3.5 border border-border/70 space-y-2">
                                        <label className="text-caption text-muted-foreground font-bold uppercase tracking-widest block">Donjons visés</label>
                                        <div className="flex flex-wrap gap-2">
                                            {joinable.map((s) => {
                                                const isTicked = targets.includes(s.index);
                                                return (
                                                    <button key={s.index} type="button" onClick={() => toggleTarget(s.index)}
                                                        className={cn(
                                                            "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                                                            isTicked
                                                                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                                                                : "border-border/60 bg-surface/70 text-muted-foreground hover:border-border hover:text-foreground"
                                                        )}>
                                                        {isTicked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded border border-border/70" />}
                                                        <span className="max-w-[150px] truncate">#{s.index + 1} {s.dungeon?.name}</span>
                                                        <span className={cn("font-mono", s.isFull ? "text-amber-400" : "text-emerald-400")}>
                                                            {s.isFull ? "file" : `${s.spotsLeft} dispo${s.spotsLeft > 1 ? "s" : ""}`}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {joinable.some((s) => s.isFull) && (
                                            <p className="text-caption text-amber-400">
                                                Un donjon complet t&apos;inscrit en file d&apos;attente de ce donjon précis.
                                            </p>
                                        )}
                                    </div>
                                )}
                                {targetsAllFull && (
                                    <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-3">
                                        <AlarmClock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                        <p className="text-xs text-foreground leading-relaxed">
                                            {isMulti
                                                ? <>Les donjons visés sont <strong>complets</strong>. Tu rejoindras leur file d&apos;attente — si une place se libère, le créateur pourra t&apos;accepter.</>
                                                : <>Le groupe est <strong>complet</strong>. Tu peux rejoindre la file d&apos;attente — si une place se libère, le créateur pourra t&apos;accepter.</>}
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
                                        isMulti && targets.length === 0
                                            ? "bg-surface/60 text-muted-foreground border border-border/70"
                                            : targetsAllFull
                                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black"
                                                : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-950/20 border border-emerald-400/40"
                                    )}
                                    onClick={handleJoin}
                                    disabled={isPending || (isMulti && targets.length === 0)}
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    {isMulti
                                        ? targets.length > 0
                                            ? `Envoyer ma candidature — ${targets.length} donjon${targets.length > 1 ? "s" : ""}`
                                            : "Choisis au moins un donjon"
                                        : targetsAllFull ? "Rejoindre la file d'attente" : "Envoyer ma candidature"}
                                </Button>
                            </div>
                        )}

                        {/* Mes inscriptions — **une par donjon** en multi (#26). Avant, un seul
                            état global : impossible de voir (ni de retirer) un donjon précis. */}
                        {!isOwner && myParticipations.length > 0 && (
                            <div className="border-t border-border/70 pt-5 space-y-2">
                                <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Mes inscriptions</p>
                                {myParticipations.map((p) => {
                                    const dungeonName = p.dungeonIndex != null ? multiDungeons[p.dungeonIndex]?.name : null;
                                    return (
                                        <div key={p.id} className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={cn("text-sm font-semibold flex items-center gap-2 shrink-0", p.status === "ACCEPTED" ? "text-emerald-400" : "text-amber-400")}>
                                                    {p.status === "ACCEPTED" ? <CheckCircle2 className="w-4 h-4" /> : <AlarmClock className="w-4 h-4" />}
                                                    {p.status === "ACCEPTED" ? "Inscrit" : "En file d'attente"}
                                                </span>
                                                <span className={cn("text-xs truncate", dungeonName ? "text-muted-foreground" : "text-amber-400")}>
                                                    {dungeonName ? `· ${dungeonName}` : isMulti ? "· sans donjon" : ""}
                                                </span>
                                            </div>
                                            <Button size="sm" variant="outline" onClick={() => handleLeave(p.dungeonIndex ?? null)} disabled={isPending}
                                                className="shrink-0 border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger rounded-lg">
                                                <LogOut className="w-4 h-4 mr-1.5" /> Se désinscrire
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Actions du créateur (ou d'un admin) : relancer, modifier, TERMINER. */}
                        {(isOwner || isAdmin) && (post.status === "OPEN" || post.status === "FULL") && (
                            <div className="border-t border-border/70 pt-5 flex flex-wrap gap-3">
                                {isOwner && (
                                    <>
                                        {post.isDiscordPublished && post.discordMessageId && acceptedParticipants.length > 0 && (
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
                                {/* Posts dont le message d'ouverture porte **encore tout** (ancien
                                    format : N embeds + N rangées) ou dont un message de donjon
                                    manque : on republie en « un message par donjon ». Visible
                                    créateur **et** admin — c'est un outil de reprise, jamais un
                                    réglage (disparaît dès que le format est bon). */}
                                {isMulti && post.isDiscordPublished && post.discordMessageId && !hasPerDungeonLayout && (
                                    <Button
                                        variant="outline"
                                        className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/20 font-bold h-11 transition-all px-4 rounded-xl"
                                        onClick={handleRepublishLayout}
                                        disabled={isPending}
                                        title="Réparer le post Discord : un message par donjon (le message d'ouverture devient le chapeau, les anciens messages de donjon sont remplacés)"
                                    >
                                        <Layers className="w-4 h-4 mr-2" />
                                        Republier en 1 msg/donjon
                                    </Button>
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
