"use client";

import { useState, useTransition } from "react";
import { Ban, Trash2, RefreshCw, Archive, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { RosterRow } from "@/lib/member-roster";
import {
    addMemberRegistryComment,
    recordMemberDeparture,
    reintegrateMember,
    setMemberTrialState,
    updateMemberAlts,
    updateMemberRecruiter,
    updateMemberRegistryIdentity,
} from "@/server/actions/member-lifecycle-actions";
import { RelanceModal } from "./relance-modal";
import { VacationEditDialog } from "./vacation-edit-dialog";

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
    const [mulesText, setMulesText] = useState((row?.mules ?? []).map((mule) => mule.pseudo).join("\n"));
    const [comment, setComment] = useState("");

    if (!row) {
        return null;
    }

    const isSelf = row.userId !== null && row.userId === currentUserId;
    const isOwner = !!row.discordId && !!ownerId && row.discordId === ownerId;
    const isDashboard = row.dashboard && !!row.profileId;
    const canEdit = canManageMembers && isDashboard && !isOwner;
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
        if (!row?.profileId) return;
        run(
            () =>
                updateMemberRegistryIdentity(guildId, {
                    profileId: row.profileId as string,
                    pseudoDofus: pseudoDofus.trim() || null,
                    ankamaId: ankamaId.trim() || null,
                    guildJoinedAt: joinedAt ? new Date(`${joinedAt}T00:00:00.000Z`).toISOString() : null,
                }),
            "Identité du registre mise à jour"
        );
    }

    function handleSaveTrial() {
        if (!row?.profileId) return;
        run(
            () =>
                setMemberTrialState(guildId, row.profileId as string, {
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
        if (!row?.profileId) return;
        run(
            () => updateMemberRecruiter(guildId, row.profileId as string, recruiterId === "NONE" ? null : recruiterId),
            "Recruteur mis à jour"
        );
    }

    function handleSaveMules() {
        if (!row?.profileId) return;
        const mules = mulesText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((pseudo) => ({ pseudo }));
        run(() => updateMemberAlts(guildId, row.profileId as string, mules), "Mules mises à jour");
    }

    function handleAddComment() {
        if (!row?.profileId) return;
        if (!comment.trim()) {
            toast.error("Le commentaire est vide.");
            return;
        }
        run(
            () => addMemberRegistryComment(guildId, { profileId: row.profileId as string, body: comment.trim() }),
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

                    <div className="space-y-6">
                        {/* ── 1. Profil & actions ─────────────────────────────── */}
                        <section className="space-y-3">
                            <h3 className="text-caption uppercase text-muted-foreground">Profil & actions</h3>
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
                                <p className="rounded-md border border-border bg-surface/40 p-3 text-xs text-muted-foreground">
                                    Membre présent sur Discord sans profil dashboard : pas d&apos;essai, de
                                    recruteur ni de journal au registre.
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
                                        <Button size="sm" variant="outline" onClick={handleSaveIdentity} disabled={isPending}>
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
                                        {(row.status === "ARCHIVED" || row.status === "BANNED") && (
                                            <Button size="sm" variant="outline" onClick={handleReintegrate} disabled={isPending}>
                                                Réintégrer
                                            </Button>
                                        )}
                                        <Button size="sm" variant="ghost" onClick={() => setVacationOpen(true)}>
                                            Vacances
                                        </Button>
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
                            <h3 className="text-caption uppercase text-muted-foreground">Registre</h3>

                            {isDashboard ? (
                                <>
                                    <div className="flex flex-wrap items-end gap-2">
                                        <div className="min-w-48 flex-1 space-y-1.5">
                                            <Label className="text-xs">Recruteur</Label>
                                            <Select value={recruiterId} onValueChange={setRecruiterId} disabled={!canEdit}>
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE" className="text-xs">Aucun</SelectItem>
                                                    {recruiterOptions.map((option) => (
                                                        <SelectItem key={option.id} value={option.id} className="text-xs">
                                                            {option.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {canEdit && (
                                            <Button size="sm" variant="outline" onClick={handleSaveRecruiter} disabled={isPending}>
                                                Enregistrer
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="member-mules" className="text-xs">Mules (une par ligne)</Label>
                                        <Textarea
                                            id="member-mules"
                                            value={mulesText}
                                            onChange={(event) => setMulesText(event.target.value)}
                                            rows={3}
                                            className="text-sm"
                                            disabled={!canEdit}
                                        />
                                        {canEdit && (
                                            <Button size="sm" variant="outline" onClick={handleSaveMules} disabled={isPending}>
                                                Enregistrer les mules
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs">Journal du staff</Label>
                                        {row.comments.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">Aucun commentaire.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {row.comments.map((entry) => (
                                                    <li
                                                        key={entry.id}
                                                        className="rounded-md border border-border bg-surface/40 p-2.5"
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
                            <h3 className="text-caption uppercase text-muted-foreground">Discord</h3>
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

                    <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-caption text-muted-foreground">
                            {canDeleteMembers
                                ? "La suppression définitive efface les données de guilde et ne laisse aucune exclusion."
                                : "Suppression définitive : permission « Supprimer un profil de guilde » requise."}
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
                                        <AlertDialogTitle>Supprimer définitivement ce profil ?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Le profil de {row.displayName} est supprimé pour cette guilde : ses données SigilOS
                                            de guilde (missions, succès, progression, journal) sont effacées. Aucune exclusion
                                            n&apos;est conservée — s&apos;il revient, il repart comme un nouvel arrivant.
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
                                            Supprimer définitivement
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
