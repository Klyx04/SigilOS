"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpDown, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
import { GameIcon } from "@/components/shared/game-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    DEFAULT_ROSTER_FILTERS,
    DEFAULT_ROSTER_SORT,
    queryRoster,
    rosterDashboardCounts,
    rosterRoleOptions,
    rosterStatusCounts,
    type RosterDashboardFilter,
    type RosterFilters,
    type RosterRow,
    type RosterRoleInput,
    type RosterSort,
    type RosterSortKey,
    type RosterStatusFilter,
} from "@/lib/member-roster";

import { MemberDetailDialog, type DeleteRowAction } from "./member-detail-dialog";
import { purgeMemberFromGuild } from "@/server/actions/lifecycle-actions";
import { godPurgeMemberFromGuild } from "@/server/actions/god-lifecycle-actions";

const PAGE_SIZE = 25;

const STATUS_FILTERS: { value: RosterStatusFilter; label: string }[] = [
    { value: "ACTIVE", label: "Actifs" },
    { value: "ARCHIVED", label: "Archivés" },
    { value: "BANNED", label: "Exclus" },
    { value: "ALL", label: "Tous" },
];

const DASHBOARD_FILTERS: { value: RosterDashboardFilter; label: string }[] = [
    { value: "ALL", label: "Les deux" },
    { value: "DASHBOARD", label: "Dashboard" },
    { value: "MISSING", label: "Hors dashboard" },
];

const SORT_OPTIONS: { value: RosterSortKey; label: string }[] = [
    { value: "joinedAt", label: "Arrivée" },
    { value: "seniority", label: "Ancienneté" },
    { value: "name", label: "Pseudo" },
];

const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Actif",
    ARCHIVED: "Archivé",
    BANNED: "Exclu",
};

/** Asset Dofus par statut (jamais d'emoji dans un libellé structurant). */
const STATUS_ICONS: Record<string, string> = {
    ACTIVE: "circle-tick.png",
    ARCHIVED: "havre-sac.png",
    BANNED: "lock.png",
};

function formatDay(iso: string | null): string {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return format(date, "dd MMM yyyy", { locale: fr });
}

/** Ancienneté lisible : jours, mois puis années. */
function seniorityLabel(days: number | null): string {
    if (days === null) return "—";
    if (days < 31) return `${days} j`;
    if (days < 365) return `${Math.floor(days / 30)} mois`;
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years} an${years > 1 ? "s" : ""} ${months} mois` : `${years} an${years > 1 ? "s" : ""}`;
}

function trialLabel(row: RosterRow): string {
    if (!row.trial) return "—";
    if (row.trial.validated) return "Validé";
    if (row.trial.decision === "prolonge") return "Prolongé";
    return row.trial.remainingDays !== null && row.trial.remainingDays >= 0
        ? `Essai · ${row.trial.remainingDays} j`
        : "En essai";
}

function StatusBadge({ row }: { row: RosterRow }) {
    // Une exclusion active prime sur « Hors dashboard » : c'est elle qui ferme la porte.
    // (Mesure du 25/10/2026 : un exclu dont le profil a été purgé n'a aucune fiche et
    // s'affichait « Hors dashboard », donc illisible en tant qu'exclusion.)
    if (row.status !== "BANNED" && !row.dashboard) {
        return (
            <Badge
                variant="outline"
                className="gap-1.5 border-border-strong text-caption font-medium text-muted-foreground"
            >
                <GameIcon src="info.png" className="h-3 w-3" />
                Hors dashboard
            </Badge>
        );
    }
    const tone =
        row.status === "ACTIVE"
            ? "border-accent-soft-border text-accent"
            : row.status === "ARCHIVED"
              ? "border-border-strong text-muted-foreground"
              : "border-border-strong text-danger";
    return (
        <Badge variant="outline" className={cn("gap-1.5 text-caption font-medium", tone)}>
            <GameIcon src={STATUS_ICONS[row.status ?? ""] ?? "info.png"} className="h-3 w-3" />
            {STATUS_LABELS[row.status ?? ""] ?? "—"}
        </Badge>
    );
}

function MemberIdentity({ row }: { row: RosterRow }) {
    const secondary = row.username
        ? `@${row.username}`
        : row.pseudoDofus && row.pseudoDofus !== row.displayName
          ? row.pseudoDofus
          : row.discordId ?? "—";
    return (
        <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0 rounded-md">
                <DiscordAvatarImage src={row.avatar} alt="" className="object-cover" />
                <AvatarFallback className="rounded-md text-caption">
                    {row.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{row.displayName}</p>
                <p className="truncate text-caption text-muted-foreground">{secondary}</p>
            </div>
        </div>
    );
}

interface MemberRosterListProps {
    guildId: string;
    rows: RosterRow[];
    roles: RosterRoleInput[];
    /** Ids des rôles **autorisés dashboard** : le filtre de rôles ne propose que ceux-là. */
    dashboardRoleIds?: string[];
    canManageMembers: boolean;
    canDeleteMembers: boolean;
    currentUserId: string;
    ownerId: string | null;
    /** `guild` = dashboard (actions de guilde) · `god` = vue God (purge de compte possible). */
    variant?: "guild" | "god";
    /** Id interne de la guilde (requis quand `variant === "god"`). */
    godGuildId?: string;
}

export function MemberRosterList({
    guildId,
    rows,
    roles,
    dashboardRoleIds,
    canManageMembers,
    canDeleteMembers,
    currentUserId,
    ownerId,
    variant = "guild",
    godGuildId,
}: MemberRosterListProps) {
    const [filters, setFilters] = useState<RosterFilters>(DEFAULT_ROSTER_FILTERS);
    const [sort, setSort] = useState<RosterSort>(DEFAULT_ROSTER_SORT);
    const [page, setPage] = useState(1);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    // Lot 2 — après une écriture, la liste derrière la modale relit la vérité serveur.
    // `router.refresh()` ne touche ni les filtres, ni la page, ni la modale ouverte
    // (le `selected` retombe déjà sur `rows` non filtré).
    const router = useRouter();

    // Compteurs facetés : chaque pastille est calculée sur les lignes qui passent **toutes les
    // autres** facettes (recherche, rôle, inscription, statut) — le nombre affiché est donc celui
    // qu'on obtient en cliquant, jamais un total global trompeur.
    const statusCounts = useMemo(() => rosterStatusCounts(rows, filters), [rows, filters]);
    const dashboardCounts = useMemo(() => rosterDashboardCounts(rows, filters), [rows, filters]);
    const roleOptions = useMemo(
        () => rosterRoleOptions(roles, rows, dashboardRoleIds),
        [roles, rows, dashboardRoleIds]
    );

    const { filtered, page: pageData } = useMemo(
        () => queryRoster(rows, filters, sort, page, PAGE_SIZE),
        [rows, filters, sort, page]
    );

    const selected = useMemo(
        () => filtered.find((row) => row.key === selectedKey) ?? rows.find((row) => row.key === selectedKey) ?? null,
        [filtered, rows, selectedKey]
    );

    const recruiterOptions = useMemo(
        () =>
            rows
                .filter((candidate) => candidate.dashboard && candidate.profileId)
                .map((candidate) => ({ id: candidate.profileId as string, name: candidate.displayName })),
        [rows]
    );

    const handleDelete: DeleteRowAction = (target, deleteAccount) => {
        if (!target.profileId) return Promise.resolve({ success: false, error: "Profil introuvable" });
        return variant === "god" && godGuildId
            ? godPurgeMemberFromGuild(godGuildId, target.profileId, { deleteAccount })
            : purgeMemberFromGuild(guildId, target.profileId);
    };

    function patchFilters(patch: Partial<RosterFilters>) {
        setFilters((prev) => ({ ...prev, ...patch }));
        setPage(1);
    }

    function resetFilters() {
        setFilters(DEFAULT_ROSTER_FILTERS);
        setSort(DEFAULT_ROSTER_SORT);
        setPage(1);
    }


    return (
        <div className="space-y-4">
            {/* Filtres de statut + recherche */}
            <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface p-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                    {STATUS_FILTERS.map((option) => {
                        const active = filters.status === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => patchFilters({ status: option.value })}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                                    active
                                        ? "border-accent-soft-border bg-accent-soft text-accent"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {option.label}
                                <span className="tabular-nums text-caption text-muted-foreground">
                                    {statusCounts[option.value]}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={filters.search}
                            onChange={(event) => patchFilters({ search: event.target.value })}
                            placeholder="Rechercher un membre…"
                            className="h-9 w-full pl-8 text-xs sm:w-56"
                        />
                    </div>

                    <Select value={filters.roleId} onValueChange={(value) => patchFilters({ roleId: value })}>
                        <SelectTrigger className="h-9 w-full text-xs sm:w-44">
                            <SelectValue placeholder="Rôle Discord" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL" className="text-xs">Tous les rôles</SelectItem>
                            {roleOptions.map((role) => (
                                <SelectItem key={role.id} value={role.id} className="text-xs">
                                    {role.name} ({role.count})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={`${sort.key}:${sort.direction}`}
                        onValueChange={(value) => {
                            const [key, direction] = value.split(":") as [RosterSortKey, "asc" | "desc"];
                            setSort({ key, direction });
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="h-9 w-full text-xs sm:w-44">
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_OPTIONS.flatMap((option) => [
                                <SelectItem key={`${option.value}:desc`} value={`${option.value}:desc`} className="text-xs">
                                    {option.label} · décroissant
                                </SelectItem>,
                                <SelectItem key={`${option.value}:asc`} value={`${option.value}:asc`} className="text-xs">
                                    {option.label} · croissant
                                </SelectItem>,
                            ])}
                        </SelectContent>
                    </Select>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetFilters}
                        className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Réinitialiser
                    </Button>
                </div>
            </div>

            {/* Inscription */}
            <div className="flex flex-wrap items-center gap-1.5">
                {DASHBOARD_FILTERS.map((option) => {
                    const active = filters.dashboard === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => patchFilters({ dashboard: option.value })}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                                active
                                    ? "border-accent-soft-border bg-accent-soft text-accent"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {option.label}
                            <span className="tabular-nums text-caption text-muted-foreground">
                                {dashboardCounts[option.value]}
                            </span>
                        </button>
                    );
                })}
                <span className="ml-auto tabular-nums text-caption text-muted-foreground">
                    {filtered.length} membre{filtered.length > 1 ? "s" : ""}
                </span>
            </div>

            {pageData.total === 0 ? (
                <EmptyState
                    variant="minimal"
                    icon={Search}
                    title="Aucun membre"
                    description="Aucun membre ne correspond à ces filtres."
                />
            ) : (
                <>
                    <div className="hidden overflow-hidden rounded-lg border border-border-strong md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-caption uppercase text-muted-foreground">Membre</TableHead>
                                    <TableHead className="text-caption uppercase text-muted-foreground">Statut</TableHead>
                                    <TableHead className="text-caption uppercase text-muted-foreground">Arrivée</TableHead>
                                    <TableHead className="text-caption uppercase text-muted-foreground">Ancienneté</TableHead>
                                    <TableHead className="text-caption uppercase text-muted-foreground">Essai</TableHead>
                                    <TableHead className="text-caption uppercase text-muted-foreground">Recruteur</TableHead>
                                    <TableHead className="w-10" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageData.items.map((row) => (
                                    <TableRow
                                        key={row.key}
                                        onClick={() => setSelectedKey(row.key)}
                                        className="cursor-pointer border-border hover:bg-elevated/50"
                                    >
                                        <TableCell>
                                            <MemberIdentity row={row} />
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge row={row} />
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{formatDay(row.joinedAt)}</TableCell>
                                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                                            {seniorityLabel(row.seniorityDays)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{trialLabel(row)}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {row.recruiter?.name ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            <ChevronRight className="ml-auto h-4 w-4" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="space-y-2 md:hidden">
                        {pageData.items.map((row) => (
                            <button
                                key={row.key}
                                type="button"
                                onClick={() => setSelectedKey(row.key)}
                                className="w-full rounded-lg border border-border-strong bg-surface p-3 text-left"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <MemberIdentity row={row} />
                                    <StatusBadge row={row} />
                                </div>
                                <dl className="mt-3 grid grid-cols-2 gap-2">
                                    <div>
                                        <dt className="text-caption uppercase text-muted-foreground">Arrivée</dt>
                                        <dd className="text-xs text-foreground">{formatDay(row.joinedAt)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-caption uppercase text-muted-foreground">Ancienneté</dt>
                                        <dd className="text-xs tabular-nums text-foreground">
                                            {seniorityLabel(row.seniorityDays)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-caption uppercase text-muted-foreground">Essai</dt>
                                        <dd className="text-xs text-foreground">{trialLabel(row)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-caption uppercase text-muted-foreground">Recruteur</dt>
                                        <dd className="text-xs text-foreground">{row.recruiter?.name ?? "—"}</dd>
                                    </div>
                                </dl>
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="tabular-nums text-caption text-muted-foreground">
                            Page {pageData.page} sur {pageData.totalPages} · {pageData.total} membre
                            {pageData.total > 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                disabled={!pageData.hasPrev}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                Précédent
                            </Button>
                            {(() => {
                                const total = pageData.totalPages;
                                const current = pageData.page;
                                const start = Math.max(1, current - 2);
                                const end = Math.min(total, current + 2);
                                const numbers: number[] = [];
                                for (let index = start; index <= end; index += 1) numbers.push(index);
                                return numbers.map((number) => (
                                    <Button
                                        key={number}
                                        type="button"
                                        variant={number === current ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 w-8 p-0 text-xs tabular-nums"
                                        onClick={() => setPage(number)}
                                    >
                                        {number}
                                    </Button>
                                ));
                            })()}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                disabled={!pageData.hasNext}
                                onClick={() => setPage((current) => current + 1)}
                            >
                                Suivant
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                    <MemberDetailDialog
                        key={selected?.key ?? "none"}
                        guildId={guildId}
                        row={selected}
                        recruiterOptions={recruiterOptions}
                        roles={roles}
                        canManageMembers={canManageMembers}
                        canDeleteMembers={canDeleteMembers}
                        currentUserId={currentUserId}
                        ownerId={ownerId}
                        open={selected !== null}
                        onOpenChange={(next) => {
                            if (!next) setSelectedKey(null);
                        }}
                        onDelete={canDeleteMembers ? handleDelete : undefined}
                        showAccountPurge={variant === "god"}
                        onChanged={() => router.refresh()}
                    />
                </>
            )}
        </div>
    );
}
