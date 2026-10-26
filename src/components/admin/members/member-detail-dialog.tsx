"use client";

import { useEffect, useState, useTransition } from "react";
import {
    AlertTriangle,
    ArchiveRestore,
    Ban,
    CalendarClock,
    CheckCircle2,
    Pencil,
    Palmtree,
    Trash2,
    RefreshCw,
    Archive,
    Loader2,
    MessageSquare,
    RotateCcw,
    X,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
import { GameIcon } from "@/components/shared/game-icon";
import { cn } from "@/lib/utils";
import {
    canAddRegistryComment,
    MAX_REGISTRY_COMMENTS,
    type RegistryComment,
} from "@/lib/member-registry";
import {
    applyRosterSnapshot,
    type MemberRosterSnapshot,
    type RosterMule,
    type RosterRow,
} from "@/lib/member-roster";
import {
    addMemberRegistryComment,
    deleteMemberRegistryComment,
    getMemberRegistrySnapshot,
    recordMemberDeparture,
    reintegrateMember,
    setMemberTrialState,
    updateMemberAlts,
    updateMemberRecruiter,
    updateMemberRegistryComment,
    updateMemberRegistryIdentity,
    type RegistrySubject,
} from "@/server/actions/member-lifecycle-actions";
import { getGuildMemberBans, liftGuildMemberBan } from "@/server/actions/lifecycle-actions";
import { RelanceModal } from "./relance-modal";
import { VacationEditDialog } from "./vacation-edit-dialog";
import { MemberDiscordActivity } from "./member-discord-activity";
import { RecruiterPicker } from "./recruiter-picker";
import { MemberMulesEditor } from "./member-mules-editor";

/** Action de suppression branchée par le parent (guilde ou God) — le dialogue ignore la portée. */
export type DeleteRowAction = (
    row: RosterRow,
    deleteAccount: boolean
) => Promise<{ success: boolean; error?: string }>;

export interface MemberDetailDialogProps {
    guildId: string;
    row: RosterRow | null;
    recruiterOptions: { id: string; name: string }[];
    roles: { id: string; name: string; color?: number | null }[];
    canManageMembers: boolean;
    canDeleteMembers: boolean;
    currentUserId: string;
    ownerId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Suppression définitive (B-3). Absente = aucun bouton de suppression. */
    onDelete?: DeleteRowAction;
    /** Affiche l'option « purger le compte plateforme » (réservée au God). */
    showAccountPurge?: boolean;
    /** Rafraîchit la liste après une mutation. */
    onChanged?: () => void;
}

const DEPARTURE_CATEGORIES: { value: "VOLUNTARY" | "INACTIVITY" | "BEHAVIOR" | "OTHER"; label: string }[] = [
    { value: "VOLUNTARY", label: "Départ volontaire" },
    { value: "INACTIVITY", label: "Inactivité" },
    { value: "BEHAVIOR", label: "Comportement" },
    { value: "OTHER", label: "Autre" },
];

const STATUS_TONES: Record<string, string> = {
    ACTIVE: "text-success",
    ARCHIVED: "text-muted-foreground",
    BANNED: "text-danger",
};

const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Actif",
    ARCHIVED: "Archivé",
    BANNED: "Exclu",
};

function formatDay(iso: string | null): string {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return format(date, "dd MMM yyyy", { locale: fr });
}

/** Heure locale `HH:MM` d'un instant **serveur** (ISO) — jamais l'horloge du poste. */
function formatTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return format(date, "HH:mm", { locale: fr });
}

/**
 * État d'essai lisible (lot 3) : validé, en cours (jours restants) ou échu.
 * Aucun état inventé — un essai sans échéance le dit.
 */
function trialBadge(trial: RosterRow["trial"]): { label: string; tone: string } | null {
    if (!trial) return null;
    if (trial.validated) return { label: "Essai validé", tone: "border-success/40 text-success" };
    if (!trial.endsAt) return { label: "Essai — sans échéance", tone: "border-border text-muted-foreground" };
    const remaining = trial.remainingDays ?? 0;
    if (remaining < 0) {
        return { label: `Essai échu (${Math.abs(remaining)} j)`, tone: "border-danger/40 text-danger" };
    }
    return { label: `Essai — ${remaining} j restant${remaining > 1 ? "s" : ""}`, tone: "border-warning/40 text-warning" };
}

/** Titre de section : asset Dofus réel + accent SigilOS (jamais un glyphe générique). */
function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
    return (
        <h3 className="flex items-center gap-2 text-caption uppercase text-accent">
            <GameIcon src={icon} className="h-3.5 w-3.5" />
            {children}
        </h3>
    );
}

export function MemberDetailDialog({
    guildId,
    row,
    recruiterOptions,
    roles,
    canManageMembers,
    canDeleteMembers,
    currentUserId,
    ownerId,
    open,
    onOpenChange,
    onDelete,
    showAccountPurge = false,
    onChanged,
}: MemberDetailDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [relanceTargets, setRelanceTargets] = useState<{ id: string; name: string }[] | null>(null);
    const [vacationOpen, setVacationOpen] = useState(false);
    const [deleteAccount, setDeleteAccount] = useState(false);

    const [pseudoDofus, setPseudoDofus] = useState(row?.pseudoDofus ?? "");
    const [ankamaId, setAnkamaId] = useState(row?.ankamaId ?? "");
    const [joinedAt, setJoinedAt] = useState(row?.joinedAt ? row.joinedAt.slice(0, 10) : "");
    const [trialEndsAt, setTrialEndsAt] = useState(row?.trial?.endsAt ? row.trial.endsAt.slice(0, 10) : "");
    const [departureReason, setDepartureReason] = useState("");
    const [departureCategory, setDepartureCategory] =
        useState<"VOLUNTARY" | "INACTIVITY" | "BEHAVIOR" | "OTHER">("VOLUNTARY");
    const [recruiterId, setRecruiterId] = useState(row?.recruiter?.id ?? "NONE");
    const [mules, setMules] = useState<RosterMule[]>(row?.mules ?? []);
    const [comment, setComment] = useState("");
    /** Lot 4 — édition en ligne d'un commentaire du journal (une seule à la fois). */
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState("");
    /** Lot 4 — confirmation de suppression d'un commentaire. */
    const [deletingComment, setDeletingComment] = useState<RegistryComment | null>(null);
    /** Lot 2 — photo serveur de la fiche (null = aucune relecture depuis l'ouverture). */
    const [snapshot, setSnapshot] = useState<MemberRosterSnapshot | null>(null);
    /**
     * Instant du dernier enregistrement **confirmé** (ISO) : celui de la relecture serveur,
     * ou à défaut l'horloge locale quand la relecture a échoué (le bandeau le dit alors).
     */
    const [saveStamp, setSaveStamp] = useState<string | null>(null);
    /** Relecture impossible **après** une écriture réussie : l'écran le dit, il ne ment pas. */
    const [rereadError, setRereadError] = useState<string | null>(null);
    /** Onglet de la fiche : la fiche registre, ou l'activité Discord mesurée. */
    const [detailTab, setDetailTab] = useState<"fiche" | "discord">("fiche");

    /** Exclusion active (tombstone) de la personne affichée — `null` = aucune, ou pas le droit de la lire. */
    const [activeExclusion, setActiveExclusion] = useState<{
        reason: string;
        createdAt: string;
        bannedByName: string | null;
    } | null>(null);

    const displayedDiscordId = row?.discordId ?? null;

    /**
     * F-01 — mesure du 25/10/2026 : la modale permettait d'**exclure** mais n'offrait aucun moyen
     * de **lever** l'exclusion ; le staff devait passer par le panneau God, et un exclu dont le
     * profil avait été purgé n'apparaissait nulle part. On relit l'exclusion active à l'ouverture
     * (source unique : `getGuildMemberBans`, même garde de permission que la levée).
     */
    useEffect(() => {
        if (!open || !displayedDiscordId || !canManageMembers) {
            setActiveExclusion(null);
            return;
        }
        let cancelled = false;
        getGuildMemberBans(guildId)
            .then((res) => {
                if (cancelled) return;
                const ban = res.success
                    ? (
                          res.data as {
                              discordId: string;
                              reason: string;
                              createdAt: Date | string;
                              bannedByName: string | null;
                              liftedAt: Date | string | null;
                          }[]
                      ).find((entry) => entry.discordId === displayedDiscordId && !entry.liftedAt)
                    : undefined;
                setActiveExclusion(
                    ban
                        ? {
                              reason: ban.reason,
                              createdAt: new Date(ban.createdAt).toISOString(),
                              bannedByName: ban.bannedByName ?? null,
                          }
                        : null
                );
            })
            .catch(() => {
                // Fail-closed côté affichage : sans lecture, on n'invente pas d'exclusion.
                if (!cancelled) setActiveExclusion(null);
            });
        return () => {
            cancelled = true;
        };
    }, [open, displayedDiscordId, guildId, canManageMembers]);

    if (!row) {
        return null;
    }

    /**
     * Ligne **affichée** : la ligne reçue du serveur, recouverte par la photo relue après
     * chaque enregistrement. Une seule règle de fusion (`applyRosterSnapshot`), testée.
     */
    const current: RosterRow = snapshot ? applyRosterSnapshot(row, snapshot) : row;

    const isSelf = current.userId !== null && current.userId === currentUserId;
    const isOwner = !!current.discordId && !!ownerId && current.discordId === ownerId;
    const isDashboard = current.dashboard && !!current.profileId;
    /** B-2 : les **deux** natures de lignes sont éditables (profil dashboard ou membre Discord). */
    const canEdit = canManageMembers && (isDashboard || !!current.discordId) && !isOwner;
    /** Sujet de l'écriture : le profil quand il existe, sinon le membre Discord hors dashboard. */
    const subject: RegistrySubject = current.profileId
        ? { profileId: current.profileId }
        : { discordId: current.discordId ?? "" };
    const roleNames = new Map(roles.map((role) => [role.id, role.name]));
    /** Lot 3 — état d'essai lisible (badge d'en-tête), calculé une seule fois. */
    const trialState = trialBadge(current.trial);

    /** Recharge les champs éditables depuis la vérité serveur (lot 2). */
    function syncFormFrom(next: RosterRow) {
        setPseudoDofus(next.pseudoDofus ?? "");
        setAnkamaId(next.ankamaId ?? "");
        setJoinedAt(next.joinedAt ? next.joinedAt.slice(0, 10) : "");
        setTrialEndsAt(next.trial?.endsAt ? next.trial.endsAt.slice(0, 10) : "");
        setRecruiterId(next.recruiter?.id ?? "NONE");
        setMules(next.mules);
    }

    /**
     * Exécute une mutation serveur, **relit la fiche** puis rend compte honnêtement.
     * Un seul chemin pour les sept écritures : aucune ne peut oublier la relecture.
     */
    function run(
        action: () => Promise<{ success: boolean; error?: string }>,
        successMessage: string,
        onDone?: () => void
    ) {
        startTransition(async () => {
            try {
                const result = await action();
                if (!result.success) {
                    toast.error(result.error || "Action refusée");
                    return;
                }

                // La base a dit oui : on relit ce qu'elle contient vraiment (trim, bornes,
                // statut, journal…). Un échec de relecture n'annule pas l'écriture — il se dit.
                const fresh = await getMemberRegistrySnapshot(guildId, subject);
                if (fresh.success && fresh.data) {
                    setSnapshot(fresh.data);
                    setSaveStamp(fresh.data.readAt);
                    setRereadError(null);
                    syncFormFrom(applyRosterSnapshot(current, fresh.data));
                } else {
                    setSnapshot(null);
                    setSaveStamp(new Date().toISOString());
                    setRereadError(fresh.error || "Relecture impossible");
                }

                // Le serveur peut préciser le résultat (ex. « … — vérifié sur le ladder (niv. 200) »).
                const serverMessage = (result as { data?: { message?: string } }).data?.message;
                toast.success(serverMessage || successMessage);
                onDone?.();
                onChanged?.();
            } catch {
                toast.error("Erreur de communication");
            }
        });
    }

    function handleSaveIdentity() {
        if (!row) return;
        run(
            () =>
                updateMemberRegistryIdentity(guildId, subject, {
                    pseudoDofus: pseudoDofus.trim() || null,
                    ankamaId: ankamaId.trim() || null,
                    guildJoinedAt: joinedAt ? new Date(`${joinedAt}T00:00:00.000Z`).toISOString() : null,
                }),
            "Identité du registre mise à jour"
        );
    }

    function handleSaveTrial() {
        if (!row) return;
        run(
            () =>
                setMemberTrialState(guildId, subject, {
                    validated: true,
                    trialEndsAt: trialEndsAt ? new Date(`${trialEndsAt}T00:00:00.000Z`).toISOString() : null,
                }),
            "Essai validé"
        );
    }

    /**
     * Reprogramme l'essai : on repart d'un essai **en cours** avec une nouvelle échéance.
     * Refusé sans date — une remise à zéro sans échéance ne veut rien dire.
     */
    function handleResetTrial() {
        if (!row) return;
        if (!trialEndsAt) {
            toast.error("Choisis la nouvelle date de fin d'essai.");
            return;
        }
        run(
            () =>
                setMemberTrialState(guildId, subject, {
                    validated: false,
                    trialEndsAt: new Date(`${trialEndsAt}T00:00:00.000Z`).toISOString(),
                }),
            "Essai reprogrammé"
        );
    }

    function handleDeparture(isBan: boolean) {
        if (!row?.profileId) return;
        if (departureReason.trim().length < 3) {
            toast.error("Renseignez un motif (3 caractères minimum).");
            return;
        }
        run(
            () =>
                recordMemberDeparture(guildId, {
                    profileId: current.profileId as string,
                    reason: departureReason.trim(),
                    category: departureCategory,
                    isBan,
                }),
            isBan ? "Membre exclu" : "Membre archivé",
            () => setDepartureReason("")
        );
    }

    function handleReintegrate() {
        if (!row?.profileId) return;
        run(() => reintegrateMember(guildId, current.profileId as string), "Membre réintégré");
    }

    /**
     * F-01 — l'inverse de « Exclure » : `liftGuildMemberBan` lève le tombstone (trace
     * `MEMBER_UNBANNED`, invalidation du contexte, purge des sessions) mais **ne touche pas** au
     * statut du profil. Or « Exclure » écrit `BANNED` **et** le tombstone, et `getUserContext`
     * bloque sur les deux : sans réintégration, le bouton semblerait sans effet (mesure du
     * 25/10/2026). On enchaîne donc les deux, uniquement si le profil est encore « Exclu ».
     */
    function handleLiftExclusion() {
        const discordId = current.discordId;
        if (!discordId) return;
        const profileId = current.profileId;
        const needsReactivation = !!profileId && current.status === "BANNED";
        run(
            async () => {
                const lifted = await liftGuildMemberBan(guildId, discordId);
                if (!lifted.success) return lifted;
                if (!needsReactivation || !profileId) return lifted;
                return reintegrateMember(guildId, profileId);
            },
            "Exclusion levée — le membre peut de nouveau accéder au tableau de bord",
            () => setActiveExclusion(null)
        );
    }

    function handleSaveRecruiter() {
        if (!row) return;
        run(
            () => updateMemberRecruiter(guildId, subject, recruiterId === "NONE" ? null : recruiterId),
            "Recruteur mis à jour"
        );
    }

    function handleSaveMules() {
        if (!row) return;
        run(() => updateMemberAlts(guildId, subject, mules), "Mules mises à jour");
    }

    function handleAddComment() {
        if (!row) return;
        if (!comment.trim()) {
            toast.error("Le commentaire est vide.");
            return;
        }
        run(
            () => addMemberRegistryComment(guildId, subject, { body: comment.trim() }),
            "Commentaire ajouté",
            () => setComment("")
        );
    }

    /** Lot 4 — passe un commentaire en édition (une seule ligne à la fois). */
    function startEditComment(entry: RegistryComment) {
        setEditingCommentId(entry.id);
        setEditingCommentBody(entry.body);
    }

    function handleUpdateComment() {
        if (!editingCommentId) return;
        if (!editingCommentBody.trim()) {
            toast.error("Le commentaire est vide.");
            return;
        }
        run(
            () =>
                updateMemberRegistryComment(guildId, subject, {
                    commentId: editingCommentId,
                    body: editingCommentBody.trim(),
                }),
            "Commentaire modifié",
            () => {
                setEditingCommentId(null);
                setEditingCommentBody("");
            }
        );
    }

    function handleDeleteComment() {
        if (!deletingComment) return;
        run(
            () => deleteMemberRegistryComment(guildId, subject, deletingComment.id),
            "Commentaire supprimé",
            () => setDeletingComment(null)
        );
    }

    function handleDelete() {
        if (!onDelete || !row) return;
        run(() => onDelete(row, deleteAccount), "Profil supprimé définitivement", () => onOpenChange(false));
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 rounded-lg">
                                <DiscordAvatarImage src={current.avatar} alt="" className="object-cover" />
                                <AvatarFallback className="rounded-lg">
                                    {current.displayName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <DialogTitle className="truncate text-lg">{current.displayName}</DialogTitle>
                                <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                                    {current.username ? `@${current.username}` : current.discordId ?? "Membre Discord"}
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-caption",
                                            current.status === "BANNED"
                                                ? STATUS_TONES.BANNED
                                                : current.dashboard
                                                  ? STATUS_TONES[current.status ?? ""]
                                                  : "text-muted-foreground"
                                        )}
                                    >
                                        {current.status === "BANNED"
                                            ? STATUS_LABELS.BANNED
                                            : current.dashboard
                                              ? STATUS_LABELS[current.status ?? ""] ?? "—"
                                              : "Hors dashboard"}
                                    </Badge>
                                    {trialState && (
                                        <Badge variant="outline" className={cn("text-caption", trialState.tone)}>
                                            <CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />
                                            {trialState.label}
                                        </Badge>
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* F-01 — exclusion active : affichée AVANT les onglets, car elle explique à elle
                        seule le refus d'accès, et elle se lève ici (plus besoin du panneau God).
                        Aucun bandeau sans exclusion lue : la lecture est fail-closed. */}
                    {activeExclusion && (
                        <div
                            role="status"
                            className="flex flex-col gap-2 rounded-md border border-danger/40 bg-surface px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                            <span className="leading-relaxed text-muted-foreground">
                                <strong className="text-danger">Exclusion active</strong> depuis le{" "}
                                {formatDay(activeExclusion.createdAt)} · motif : {activeExclusion.reason}
                                {activeExclusion.bannedByName ? ` · par ${activeExclusion.bannedByName}` : ""}
                            </span>
                            {canManageMembers && current.discordId && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0"
                                    onClick={handleLiftExclusion}
                                    disabled={isPending}
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Lever l&apos;exclusion
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Lot 2 — preuve honnête : l'heure du **serveur** + l'état de la relecture.
                        Aucun bandeau sans écriture confirmée ; une relecture ratée se dit. */}
                    {saveStamp && (
                        <div
                            role="status"
                            aria-live="polite"
                            className={cn(
                                "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                                rereadError
                                    ? "border-warning/40 bg-surface text-warning"
                                    : "border-success/40 bg-surface text-success"
                            )}
                        >
                            {rereadError ? (
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            ) : (
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            )}
                            <span>
                                <strong>Enregistré à {formatTime(saveStamp)}</strong>
                                {rereadError
                                    ? ` · relecture impossible (${rereadError}) — la fiche peut être en retard`
                                    : " · valeurs relues du serveur"}
                            </span>
                        </div>
                    )}

                    {/* Onglets de la fiche : registre, puis activité Discord mesurée. */}
                    <div className="flex items-center gap-1 border-b border-border" role="tablist" aria-label="Contenu de la fiche">
                        {(
                            [
                                { id: "fiche" as const, label: "Fiche" },
                                { id: "discord" as const, label: "Activité Discord" },
                            ]
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={detailTab === tab.id}
                                onClick={() => setDetailTab(tab.id)}
                                className={cn(
                                    "px-4 py-2.5 text-xs font-semibold transition-colors",
                                    detailTab === tab.id
                                        ? "border-b-2 border-foreground text-foreground"
                                        : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {detailTab === "discord" ? (
                        <MemberDiscordActivity guildId={guildId} subject={subject} displayName={current.displayName} />
                    ) : (
                    <div className="space-y-6">
                        {/* ── 1. Profil & actions ─────────────────────────────── */}
                        <section className="space-y-3">
                            <SectionTitle icon="party.png">Profil &amp; actions</SectionTitle>
                            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Arrivée</dt>
                                    <dd className="text-foreground">{formatDay(current.joinedAt)}</dd>
                                </div>
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Ancienneté</dt>
                                    <dd className="tabular-nums text-foreground">
                                        {current.seniorityDays !== null ? `${current.seniorityDays} j` : "—"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Essai</dt>
                                    <dd className="text-foreground">
                                        {current.trial ? (current.trial.validated ? "Validé" : "En cours") : "—"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Mules</dt>
                                    <dd className="tabular-nums text-foreground">{current.mules.length}</dd>
                                </div>
                            </dl>

                            {!isDashboard && (
                                <p className="rounded-md border border-border-strong bg-surface p-3 text-xs text-muted-foreground">
                                    Membre présent sur Discord <strong>sans profil dashboard</strong> : son registre
                                    (identité, essai, recruteur, mules, journal) est éditable ici et conservé pour la
                                    guilde.
                                </p>
                            )}

                            {canEdit && (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="member-pseudo" className="text-xs">Pseudo Dofus</Label>
                                        <Input
                                            id="member-pseudo"
                                            value={pseudoDofus}
                                            onChange={(event) => setPseudoDofus(event.target.value)}
                                            className="h-9 text-sm"
                                            maxLength={30}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="member-ankama" className="text-xs">Tag Ankama</Label>
                                        <Input
                                            id="member-ankama"
                                            value={ankamaId}
                                            onChange={(event) => setAnkamaId(event.target.value)}
                                            placeholder="Nom#0000"
                                            className="h-9 text-sm"
                                            maxLength={60}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="member-joined" className="text-xs">Date d&apos;arrivée</Label>
                                        <Input
                                            id="member-joined"
                                            type="date"
                                            value={joinedAt}
                                            onChange={(event) => setJoinedAt(event.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            {canEdit && (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" onClick={handleSaveIdentity} disabled={isPending}>
                                            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                            Enregistrer l&apos;identité
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                setRelanceTargets([{ id: current.discordId ?? "", name: current.displayName }])
                                            }
                                            disabled={!current.discordId}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                            Relancer
                                        </Button>
                                        {isDashboard && (current.status === "ARCHIVED" || current.status === "BANNED") && (
                                            <Button size="sm" variant="outline" onClick={handleReintegrate} disabled={isPending}>
                                                <ArchiveRestore className="h-3.5 w-3.5" />
                                                Réintégrer
                                            </Button>
                                        )}
                                        {isDashboard && (
                                            <Button size="sm" variant="ghost" onClick={() => setVacationOpen(true)}>
                                                <Palmtree className="h-3.5 w-3.5" />
                                                Vacances
                                            </Button>
                                        )}
                                    </div>

                                    <Separator />

                                    <div className="flex flex-wrap items-end gap-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="member-trial" className="text-xs">Fin d&apos;essai</Label>
                                            <Input
                                                id="member-trial"
                                                type="date"
                                                value={trialEndsAt}
                                                onChange={(event) => setTrialEndsAt(event.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveTrial}
                                            disabled={isPending || current.trial?.validated === true}
                                        >
                                            {current.trial?.validated ? "Essai validé" : "Valider l'essai"}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleResetTrial}
                                            disabled={isPending}
                                            title="Reprogrammer l'essai avec la date choisie"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                            Reprogrammer
                                        </Button>
                                    </div>

                                    {current.status === "ACTIVE" && (
                                        <>
                                            <Separator />
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-end gap-2">
                                                    <div className="min-w-48 flex-1 space-y-1.5">
                                                        <Label htmlFor="member-departure" className="text-xs">Motif de départ</Label>
                                                        <Input
                                                            id="member-departure"
                                                            value={departureReason}
                                                            onChange={(event) => setDepartureReason(event.target.value)}
                                                            className="h-9 text-sm"
                                                            maxLength={500}
                                                        />
                                                    </div>
                                                    <Select
                                                        value={departureCategory}
                                                        onValueChange={(value) =>
                                                            setDepartureCategory(
                                                                value as "VOLUNTARY" | "INACTIVITY" | "BEHAVIOR" | "OTHER"
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="h-9 w-44 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {DEPARTURE_CATEGORIES.map((category) => (
                                                                <SelectItem key={category.value} value={category.value} className="text-xs">
                                                                    {category.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {/* Lot 3 — les deux sorties restent désactivées tant que le
                                                    motif n'est pas saisi. Le motif est obligatoire et tracé ; sans
                                                    explication, le bouton passait pour un bug (mesure du 25/10/2026). */}
                                                {departureReason.trim().length < 3 && (
                                                    <p className="text-caption text-warning">
                                                        Renseignez le <strong>motif de départ</strong> ci-dessus (3 caractères
                                                        minimum) pour activer « Archiver » et « Exclure » : il est obligatoire et tracé.
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap gap-2">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={isPending || departureReason.trim().length < 3}
                                                                title={
                                                                    departureReason.trim().length < 3
                                                                        ? "Motif de départ requis (3 caractères minimum)"
                                                                        : undefined
                                                                }
                                                            >
                                                                <Archive className="h-3.5 w-3.5" />
                                                                Archiver
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Archiver {current.displayName} ?</AlertDialogTitle>
                                                                <AlertDialogDescription asChild>
                                                                    <ul className="list-disc space-y-1 pl-4 text-left text-xs">
                                                                        <li>le profil passe en <strong>Archivé</strong> et sort des comptes actifs ;</li>
                                                                        <li>la fiche (registre, essai, mules, journal) est <strong>conservée</strong> ;</li>
                                                                        <li>aucun rôle Discord n&apos;est retiré ;</li>
                                                                        <li>le membre est <strong>réintégrable</strong> depuis cette fiche.</li>
                                                                    </ul>
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => handleDeparture(false)}
                                                                    disabled={isPending || departureReason.trim().length < 3}
                                                                >
                                                                    Oui, archiver
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-danger"
                                                                disabled={isPending || departureReason.trim().length < 3}
                                                                title={
                                                                    departureReason.trim().length < 3
                                                                        ? "Motif de départ requis (3 caractères minimum)"
                                                                        : undefined
                                                                }
                                                            >
                                                                <Ban className="h-3.5 w-3.5" />
                                                                Exclure
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Exclure {current.displayName} ?</AlertDialogTitle>
                                                                <AlertDialogDescription asChild>
                                                                    <ul className="list-disc space-y-1 pl-4 text-left text-xs">
                                                                        <li>le profil passe en <strong>Exclu</strong> (exclusion conservée en base) ;</li>
                                                                        <li>la fiche reste consultable et le motif est <strong>tracé</strong> ;</li>
                                                                        <li>aucun rôle Discord n&apos;est retiré par SigilOS ;</li>
                                                                        <li>une réintégration reste possible, mais elle doit être <strong>volontaire</strong>.</li>
                                                                    </ul>
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => handleDeparture(true)}
                                                                    disabled={isPending || departureReason.trim().length < 3}
                                                                >
                                                                    Oui, exclure
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </section>

                        {/* ── 2. Registre ────────────────────────────────────── */}
                        <section className="space-y-3">
                            <SectionTitle icon="parchment.png">Registre</SectionTitle>

                            {/* Registre : identité, essai, recruteur, mules et journal — pour un
                                profil dashboard **comme** pour un membre Discord hors dashboard
                                (les actions ciblent `{profileId}` ou `{discordId}`). */}
                            <>
                                    <div className="flex flex-wrap items-end gap-2">
                                        <div className="min-w-48 flex-1 space-y-1.5">
                                            <Label className="text-xs">Recruteur</Label>
                                            <RecruiterPicker
                                                options={recruiterOptions}
                                                value={recruiterId}
                                                onChange={setRecruiterId}
                                                disabled={!canEdit}
                                            />
                                        </div>
                                        {canEdit && (
                                            <Button size="sm" variant="outline" onClick={handleSaveRecruiter} disabled={isPending}>
                                                Enregistrer
                                            </Button>
                                        )}
                                    </div>

                                    <MemberMulesEditor
                                        guildId={guildId}
                                        mules={mules}
                                        onChange={setMules}
                                        onSave={handleSaveMules}
                                        canEdit={canEdit}
                                        isPending={isPending}
                                    />

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label className="flex items-center gap-1.5 text-xs">
                                                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                                Journal du staff
                                            </Label>
                                            <span
                                                className={cn(
                                                    "tabular-nums text-caption",
                                                    canAddRegistryComment(current.comments.length)
                                                        ? "text-muted-foreground"
                                                        : "text-warning"
                                                )}
                                            >
                                                {current.comments.length}/{MAX_REGISTRY_COMMENTS}
                                            </span>
                                        </div>
                                        {current.comments.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">Aucun commentaire.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {current.comments.map((entry) => (
                                                    <li
                                                        key={entry.id}
                                                        className="rounded-md border border-border-strong bg-surface p-2.5"
                                                    >
                                                        {editingCommentId === entry.id ? (
                                                            <div className="space-y-2">
                                                                <Textarea
                                                                    value={editingCommentBody}
                                                                    onChange={(event) => setEditingCommentBody(event.target.value)}
                                                                    rows={3}
                                                                    className="text-sm"
                                                                    maxLength={1000}
                                                                    aria-label="Modifier le commentaire"
                                                                />
                                                                <div className="flex flex-wrap justify-end gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => {
                                                                            setEditingCommentId(null);
                                                                            setEditingCommentBody("");
                                                                        }}
                                                                        disabled={isPending}
                                                                    >
                                                                        <X className="h-3.5 w-3.5" />
                                                                        Annuler
                                                                    </Button>
                                                                    <Button size="sm" onClick={handleUpdateComment} disabled={isPending}>
                                                                        {isPending ? (
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        ) : (
                                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                                        )}
                                                                        Enregistrer
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                        <p className="whitespace-pre-wrap text-xs text-foreground">{entry.body}</p>
                                                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                                            <p className="text-caption text-muted-foreground">
                                                                {entry.authorName} · {formatDay(entry.createdAt)} à{" "}
                                                                {formatTime(entry.createdAt)}
                                                            </p>
                                                            {canEdit && (
                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-7 w-7 p-0"
                                                                        aria-label="Modifier le commentaire"
                                                                        title="Modifier"
                                                                        onClick={() => startEditComment(entry)}
                                                                        disabled={isPending}
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-7 w-7 p-0 text-danger"
                                                                        aria-label="Supprimer le commentaire"
                                                                        title="Supprimer"
                                                                        onClick={() => setDeletingComment(entry)}
                                                                        disabled={isPending}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                            </>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {canEdit && (
                                            <div className="space-y-2">
                                                <Textarea
                                                    value={comment}
                                                    onChange={(event) => setComment(event.target.value)}
                                                    rows={2}
                                                    placeholder={
                                                        canAddRegistryComment(current.comments.length)
                                                            ? "Ajouter un commentaire…"
                                                            : `Plafond atteint (${MAX_REGISTRY_COMMENTS}) — supprimez un commentaire pour en ajouter un.`
                                                    }
                                                    className="text-sm"
                                                    maxLength={1000}
                                                    disabled={!canAddRegistryComment(current.comments.length)}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleAddComment}
                                                    disabled={isPending || !canAddRegistryComment(current.comments.length)}
                                                >
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                    Ajouter au journal
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </>
                        </section>
                        {/* ── 3. Discord ─────────────────────────────────────── */}
                        <section className="space-y-3">
                            <SectionTitle icon="shield.png">Discord</SectionTitle>
                            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Identifiant Discord</dt>
                                    <dd className="truncate tabular-nums text-xs text-foreground">{current.discordId ?? "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Pseudo serveur</dt>
                                    <dd className="text-foreground">{current.discordNickname ?? "—"}</dd>
                                </div>
                            </dl>
                            <div className="space-y-1.5">
                                <p className="text-caption uppercase text-muted-foreground">Rôles Discord</p>
                                {current.roles.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Aucun rôle connu.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {current.roles.map((roleId) => (
                                            <Badge
                                                key={roleId}
                                                variant="outline"
                                                className="border-border text-caption text-muted-foreground"
                                            >
                                                {roleNames.get(roleId) ?? roleId}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                    )}

                    {/* Zone sensible — réservée à une **fiche dashboard** : un membre hors dashboard
                        n'a ni bouton de suppression ni avertissement à lire, donc pas de bandeau orphelin
                        (mesure bêta du 14/10 : « Zone sensible » s'affichait sous une fiche sans action). */}
                    {isDashboard && (
                    <DialogFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div
                            className={cn(
                                "rounded-md border p-3 text-xs leading-relaxed",
                                canDeleteMembers
                                    ? "border-danger bg-surface text-muted-foreground"
                                    : "border-border-strong bg-surface text-muted-foreground"
                            )}
                        >
                            <p
                                className={cn(
                                    "flex items-center gap-2 font-medium",
                                    canDeleteMembers ? "text-danger" : "text-foreground"
                                )}
                            >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {canDeleteMembers ? "Zone sensible" : "Suppression définitive désactivée"}
                            </p>
                            <p className="mt-1">
                                {canDeleteMembers
                                    ? "La suppression définitive efface les données de guilde de ce membre et ne laisse aucune exclusion : s'il revient, il repart comme un nouvel arrivant. Pour fermer durablement l'accès, utilisez « Exclure » — l'exclusion, elle, se lève depuis cette fiche."
                                    : "Permission « Supprimer un profil de guilde » absente de votre rôle : la suppression reste hors de portée."}
                            </p>
                        </div>
                        {onDelete && canDeleteMembers && isDashboard && !isSelf && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-danger" disabled={isPending || isOwner}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Supprimer définitivement
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Supprimer définitivement {current.displayName} ?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="space-y-2 text-left text-sm text-muted-foreground">
                                                <p>
                                                    Pour cette guilde, l&apos;action est{" "}
                                                    <strong className="text-danger">irréversible</strong> :
                                                </p>
                                                <ul className="list-disc space-y-1 pl-5">
                                                    <li>
                                                        le profil et ses données de guilde (missions, succès, progression,
                                                        journal) sont effacés ;
                                                    </li>
                                                    <li>
                                                        <strong>aucune exclusion n&apos;est conservée</strong> — s&apos;il
                                                        revient, il repart comme un nouvel arrivant ;
                                                    </li>
                                                    <li>
                                                        {showAccountPurge
                                                            ? "son compte plateforme n'est touché que si vous cochez la case ci-dessous (toutes ses guildes)."
                                                            : "son compte plateforme n'est pas touché."}
                                                    </li>
                                                </ul>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    {showAccountPurge && (
                                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <input
                                                type="checkbox"
                                                checked={deleteAccount}
                                                onChange={(event) => setDeleteAccount(event.target.checked)}
                                                className="h-3.5 w-3.5"
                                            />
                                            Purger aussi son compte plateforme (toutes ses guildes)
                                        </label>
                                    )}
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Oui, supprimer définitivement
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        {isOwner && (
                            <p className="text-caption text-muted-foreground">
                                Propriétaire du serveur Discord : non supprimable depuis SigilOS.
                            </p>
                        )}
                    </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
            {relanceTargets && (
                <RelanceModal
                    guildId={guildId}
                    targets={relanceTargets}
                    onClose={() => setRelanceTargets(null)}
                />
            )}
            {/* Lot 4 — la suppression d'un commentaire se confirme et reste tracée (audit). */}
            {deletingComment && (
                <AlertDialog open onOpenChange={(next) => !next && setDeletingComment(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce commentaire ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Le commentaire de {deletingComment.authorName} sera retiré du journal. La
                                trace d&apos;audit conserve son contenu et l&apos;auteur de la suppression.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteComment} disabled={isPending}>
                                <Trash2 className="h-3.5 w-3.5" />
                                Oui, supprimer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            {vacationOpen && current.profileId && current.userId && (
                <VacationEditDialog
                    guildId={guildId}
                    profileId={current.profileId}
                    userId={current.userId}
                    memberName={current.displayName}
                    initialVacationStart={current.vacationStart}
                    initialVacationEnd={current.vacationEnd}
                    open={vacationOpen}
                    onOpenChange={setVacationOpen}
                    onSuccess={() => onChanged?.()}
                />
            )}
        </>
    );
}
