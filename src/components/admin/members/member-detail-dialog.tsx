"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Ban, Trash2, RefreshCw, Archive, Loader2 } from "lucide-react";
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
import type { RosterMule, RosterRow } from "@/lib/member-roster";
import {
    addMemberRegistryComment,
    recordMemberDeparture,
    reintegrateMember,
    setMemberTrialState,
    updateMemberAlts,
    updateMemberRecruiter,
    updateMemberRegistryIdentity,
    type RegistrySubject,
} from "@/server/actions/member-lifecycle-actions";
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
    /** Onglet de la fiche : la fiche registre, ou l'activité Discord mesurée. */
    const [detailTab, setDetailTab] = useState<"fiche" | "discord">("fiche");

    if (!row) {
        return null;
    }

    const isSelf = row.userId !== null && row.userId === currentUserId;
    const isOwner = !!row.discordId && !!ownerId && row.discordId === ownerId;
    const isDashboard = row.dashboard && !!row.profileId;
    /** B-2 : les **deux** natures de lignes sont éditables (profil dashboard ou membre Discord). */
    const canEdit = canManageMembers && (isDashboard || !!row.discordId) && !isOwner;
    /** Sujet de l'écriture : le profil quand il existe, sinon le membre Discord hors dashboard. */
    const subject: RegistrySubject = row.profileId
        ? { profileId: row.profileId }
        : { discordId: row.discordId ?? "" };
    const roleNames = new Map(roles.map((role) => [role.id, role.name]));

    /** Exécute une mutation serveur et rend compte honnêtement (jamais de succès supposé). */
    function run(
        action: () => Promise<{ success: boolean; error?: string }>,
        successMessage: string,
        onDone?: () => void
    ) {
        startTransition(async () => {
            try {
                const result = await action();
                if (result.success) {
                    toast.success(successMessage);
                    onDone?.();
                    onChanged?.();
                } else {
                    toast.error(result.error || "Action refusée");
                }
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

    function handleDeparture(isBan: boolean) {
        if (!row?.profileId) return;
        if (departureReason.trim().length < 3) {
            toast.error("Renseignez un motif (3 caractères minimum).");
            return;
        }
        run(
            () =>
                recordMemberDeparture(guildId, {
                    profileId: row.profileId as string,
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
        run(() => reintegrateMember(guildId, row.profileId as string), "Membre réintégré");
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
                                <DiscordAvatarImage src={row.avatar} alt="" className="object-cover" />
                                <AvatarFallback className="rounded-lg">
                                    {row.displayName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <DialogTitle className="truncate text-lg">{row.displayName}</DialogTitle>
                                <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                                    {row.username ? `@${row.username}` : row.discordId ?? "Membre Discord"}
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-caption",
                                            row.dashboard
                                                ? STATUS_TONES[row.status ?? ""]
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {row.dashboard ? STATUS_LABELS[row.status ?? ""] ?? "—" : "Hors dashboard"}
                                    </Badge>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

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
                        <MemberDiscordActivity guildId={guildId} subject={subject} displayName={row.displayName} />
                    ) : (
                    <div className="space-y-6">
                        {/* ── 1. Profil & actions ─────────────────────────────── */}
                        <section className="space-y-3">
                            <SectionTitle icon="party.png">Profil &amp; actions</SectionTitle>
                            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Arrivée</dt>
                                    <dd className="text-foreground">{formatDay(row.joinedAt)}</dd>
                                </div>
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Ancienneté</dt>
                                    <dd className="tabular-nums text-foreground">
                                        {row.seniorityDays !== null ? `${row.seniorityDays} j` : "—"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Essai</dt>
                                    <dd className="text-foreground">
                                        {row.trial ? (row.trial.validated ? "Validé" : "En cours") : "—"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Mules</dt>
                                    <dd className="tabular-nums text-foreground">{row.mules.length}</dd>
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
                                                setRelanceTargets([{ id: row.discordId ?? "", name: row.displayName }])
                                            }
                                            disabled={!row.discordId}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                            Relancer
                                        </Button>
                                        {isDashboard && (row.status === "ARCHIVED" || row.status === "BANNED") && (
                                            <Button size="sm" variant="outline" onClick={handleReintegrate} disabled={isPending}>
                                                Réintégrer
                                            </Button>
                                        )}
                                        {isDashboard && (
                                            <Button size="sm" variant="ghost" onClick={() => setVacationOpen(true)}>
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
                                        <Button size="sm" variant="outline" onClick={handleSaveTrial} disabled={isPending}>
                                            Valider l&apos;essai
                                        </Button>
                                    </div>

                                    {row.status === "ACTIVE" && (
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
                                                <div className="flex flex-wrap gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleDeparture(false)} disabled={isPending}>
                                                        <Archive className="h-3.5 w-3.5" />
                                                        Archiver
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-danger"
                                                        onClick={() => handleDeparture(true)}
                                                        disabled={isPending}
                                                    >
                                                        <Ban className="h-3.5 w-3.5" />
                                                        Exclure
                                                    </Button>
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

                            {isDashboard ? (
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
                                        <Label className="text-xs">Journal du staff</Label>
                                        {row.comments.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">Aucun commentaire.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {row.comments.map((entry) => (
                                                    <li
                                                        key={entry.id}
                                                        className="rounded-md border border-border-strong bg-surface p-2.5"
                                                    >
                                                        <p className="whitespace-pre-wrap text-xs text-foreground">{entry.body}</p>
                                                        <p className="mt-1 text-caption text-muted-foreground">
                                                            {entry.authorName} · {formatDay(entry.createdAt)}
                                                        </p>
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
                                                    placeholder="Ajouter un commentaire…"
                                                    className="text-sm"
                                                    maxLength={1000}
                                                />
                                                <Button size="sm" variant="outline" onClick={handleAddComment} disabled={isPending}>
                                                    Ajouter au journal
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Le registre ne concerne que les profils dashboard.
                                </p>
                            )}
                        </section>
                        {/* ── 3. Discord ─────────────────────────────────────── */}
                        <section className="space-y-3">
                            <SectionTitle icon="shield.png">Discord</SectionTitle>
                            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Identifiant Discord</dt>
                                    <dd className="truncate tabular-nums text-xs text-foreground">{row.discordId ?? "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-caption uppercase text-muted-foreground">Pseudo serveur</dt>
                                    <dd className="text-foreground">{row.discordNickname ?? "—"}</dd>
                                </div>
                            </dl>
                            <div className="space-y-1.5">
                                <p className="text-caption uppercase text-muted-foreground">Rôles Discord</p>
                                {row.roles.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Aucun rôle connu.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {row.roles.map((roleId) => (
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
                                    ? "La suppression définitive efface les données de guilde de ce membre et ne laisse aucune exclusion : s'il revient, il repart comme un nouvel arrivant."
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
                                            Supprimer définitivement {row.displayName} ?
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
            {vacationOpen && row.profileId && row.userId && (
                <VacationEditDialog
                    guildId={guildId}
                    profileId={row.profileId}
                    userId={row.userId}
                    memberName={row.displayName}
                    initialVacationStart={row.vacationStart}
                    initialVacationEnd={row.vacationEnd}
                    open={vacationOpen}
                    onOpenChange={setVacationOpen}
                    onSuccess={() => onChanged?.()}
                />
            )}
        </>
    );
}
