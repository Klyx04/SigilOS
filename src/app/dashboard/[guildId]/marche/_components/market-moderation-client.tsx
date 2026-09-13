"use client";

/**
 * Panneau de modération du Marché (S4.11 · S5.8, `market:moderate`).
 *
 * Écran **privé** : deux vues — dossiers de signalement (classement + note de
 * résolution, retrait/restauration de l'annonce) et annonces **retirées**
 * (avec ou sans signalement), chacune ouvrant l'**historique d'audit** complet.
 * Aucune règle métier ici : chaque action est déléguée à
 * `market-admin-actions` (§13.4), les listes viennent du serveur
 * (`listMarketReports`, `listWithdrawnMarketListings`) et l'historique est
 * relu à la demande (`listMarketListingAuditTrail`).
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
    MARKET_REPORT_REASON_LABELS,
    MARKET_REPORT_STATUS_CLASSES,
    MARKET_REPORT_STATUS_LABELS,
    MARKET_STATUS_CLASSES,
    MARKET_STATUS_LABELS,
    MARKET_TYPE_LABELS,
    MARKET_WITHDRAWN_SOURCE_LABELS,
} from "@/server/actions/market-constants";
import { formatKamas } from "@/lib/market/kamas";
import { MarketStatLines, type MarketStatLine } from "@/components/market/market-stat-lines";
import { cn } from "@/lib/utils";
import {
    listMarketListingAuditTrail,
    resolveMarketReport,
    restoreMarketListing,
    takeDownMarketListing,
    type MarketListingAuditRecord,
    type MarketWithdrawnListingRecord,
} from "@/server/actions/market-admin-actions";
import { toast } from "sonner";
import {
    Check,
    ChevronDown,
    ChevronUp,
    History,
    RefreshCw,
    ShieldAlert,
    XCircle,
} from "lucide-react";

type ReportReason =
    | "JET_MISMATCH"
    | "SELLER_UNREACHABLE"
    | "BUYER_ABSENT"
    | "SUSPICIOUS"
    | "FORBIDDEN"
    | "OTHER";
type ReportStatus = "OPEN" | "REVIEWED" | "CLOSED";

/** Dossier tel que le panneau le reçoit (`MarketReportRecord`, S4.11). */
export type MarketReportRow = {
    id: string;
    listingId: string;
    listingTitle: string;
    listingStatus: string;
    reason: ReportReason;
    details: string | null;
    snapshot: unknown;
    status: ReportStatus;
    resolution: string | null;
    reporterLabel: string | null;
    /**
     * S8.15 — **jet déclaré** de l'annonce signalée (icônes officielles) :
     * projection lecture seule, déjà résolue côté serveur.
     */
    listingStats: MarketStatLine[];
    createdAt: string;
    reviewedAt: string | null;
};

interface MarketModerationClientProps {
    guildId: string;
    reports: MarketReportRow[];
    /** S5.8 — annonces retirées de la guilde (`WITHDRAWN`, avec ou sans signalement). */
    withdrawn: MarketWithdrawnListingRecord[];
}

/** Résumé du `snapshot` (§6.9) : lecture défensive, jamais une exception. */
function snapshotSummary(snapshot: unknown): string | null {
    if (!snapshot || typeof snapshot !== "object") return null;
    const data = snapshot as { priceKamas?: unknown; status?: unknown };
    const parts: string[] = [];
    if (typeof data.status === "string") {
        const label = MARKET_STATUS_LABELS[data.status as keyof typeof MARKET_STATUS_LABELS];
        if (label) parts.push(`État au signalement : ${label}`);
    }
    if (typeof data.priceKamas === "number") parts.push(formatKamas(data.priceKamas));
    return parts.length > 0 ? parts.join(" · ") : null;
}

const FILTERS: { key: ReportStatus | "ALL"; label: string }[] = [
    { key: "OPEN", label: "À traiter" },
    { key: "REVIEWED", label: "En cours" },
    { key: "CLOSED", label: "Clôturés" },
    { key: "ALL", label: "Tous" },
];

interface ReportRowProps {
    guildId: string;
    report: MarketReportRow;
    isPending: boolean;
    onResolve: (report: MarketReportRow, status: "REVIEWED" | "CLOSED", note: string) => void;
    onTakeDown: (report: MarketReportRow, note: string) => void;
    onRestore: (report: MarketReportRow) => void;
}

function ReportRow({ guildId, report, isPending, onResolve, onTakeDown, onRestore }: ReportRowProps) {
    const [note, setNote] = useState("");
    const snapshot = snapshotSummary(report.snapshot);
    const open = report.status === "OPEN";
    const canTakeDown = report.listingStatus === "ACTIVE" || report.listingStatus === "RESERVED";
    const canRestore = report.listingStatus === "WITHDRAWN";

    return (
        <div className="space-y-3 rounded-xl border border-border bg-surface/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Badge
                    variant="outline"
                    className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        MARKET_REPORT_STATUS_CLASSES[report.status]
                    )}
                >
                    {MARKET_REPORT_STATUS_LABELS[report.status]}
                </Badge>
                <Link
                    href={`/dashboard/${guildId}/marche/${report.listingId}`}
                    className="truncate text-sm font-semibold text-foreground hover:underline"
                >
                    {report.listingTitle}
                </Link>
                <Badge
                    variant="outline"
                    className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        MARKET_STATUS_CLASSES[report.listingStatus as keyof typeof MARKET_STATUS_CLASSES] ?? ""
                    )}
                >
                    {MARKET_STATUS_LABELS[report.listingStatus as keyof typeof MARKET_STATUS_LABELS] ??
                        report.listingStatus}
                </Badge>
                <span className="text-[11px] text-muted-foreground sm:ml-auto">
                    {MARKET_REPORT_REASON_LABELS[report.reason]}
                </span>
            </div>

            <p className="text-xs text-muted-foreground">
                {report.reporterLabel ? `Signalé par ${report.reporterLabel}` : "Signalé par un membre"}
                {` · le ${new Date(report.createdAt).toLocaleDateString("fr-FR")}`}
                {report.reviewedAt ? ` · traité le ${new Date(report.reviewedAt).toLocaleDateString("fr-FR")}` : ""}
                {snapshot ? ` · ${snapshot}` : ""}
            </p>

            {/* S8.15 — jet déclaré : le litige « JET_MISMATCH » se juge ici. */}
            {report.listingStats.length > 0 ? (
                <MarketStatLines stats={report.listingStats} className="mt-2" />
            ) : null}

            {report.details ? <p className="text-xs italic text-muted-foreground">« {report.details} »</p> : null}

            {report.resolution ? (
                <p className="rounded-lg border border-border bg-background/40 p-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">Résolution :</strong> {report.resolution}
                </p>
            ) : null}

            {open ? (
                <>
                    <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder="Note de résolution (facultatif, mais recommandée)"
                        className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            disabled={isPending}
                            onClick={() => onResolve(report, "REVIEWED", note)}
                        >
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Prendre en charge
                        </Button>
                        <Button
                            size="sm"
                            className="gap-2"
                            disabled={isPending}
                            onClick={() => onResolve(report, "CLOSED", note)}
                        >
                            <Check className="h-3.5 w-3.5" />
                            Clôturer le dossier
                        </Button>
                        {canTakeDown && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2 text-danger hover:text-danger"
                                disabled={isPending}
                                onClick={() => onTakeDown(report, note)}
                            >
                                <XCircle className="h-3.5 w-3.5" />
                                Retirer l&apos;annonce
                            </Button>
                        )}
                        {canRestore && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                disabled={isPending}
                                onClick={() => onRestore(report)}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Restaurer l&apos;annonce
                            </Button>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    {canTakeDown && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 text-danger hover:text-danger"
                            disabled={isPending}
                            onClick={() => onTakeDown(report, report.resolution ?? "")}
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            Retirer l&apos;annonce
                        </Button>
                    )}
                    {canRestore && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            disabled={isPending}
                            onClick={() => onRestore(report)}
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Restaurer l&apos;annonce
                        </Button>
                    )}
                    {!canTakeDown && !canRestore && (
                        <span className="text-[11px] text-muted-foreground">
                            Dossier classé — l&apos;annonce n&apos;est plus modifiable depuis ce panneau.
                        </span>
                    )}
                </div>
            )}

            <AuditTrail guildId={guildId} listingId={report.listingId} />
        </div>
    );
}

/** Détail lisible des données d'audit (§0.1 : lecture défensive, jamais d'exception). */
function auditDetail(entry: MarketListingAuditRecord): string | null {
    const read = (value: unknown): Record<string, unknown> | null =>
        value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
    const previous = read(entry.previousData);
    const next = read(entry.nextData);
    const statusLabel = (value: unknown): string | null =>
        typeof value === "string"
            ? MARKET_STATUS_LABELS[value as keyof typeof MARKET_STATUS_LABELS] ?? value
            : null;

    const parts: string[] = [];
    const from = statusLabel(previous?.status);
    const to = statusLabel(next?.status);
    if (from && to && from !== to) parts.push(`${from} → ${to}`);
    else if (to) parts.push(`État : ${to}`);
    if (typeof next?.priceKamas === "number") parts.push(formatKamas(next.priceKamas));
    return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * S5.8 — historique d'audit d'**une annonce**, chargé à la demande.
 *
 * Aucun état dupliqué : chaque ouverture relit le journal côté serveur, qui
 * reste la seule source de vérité (§13.4). Un échec de lecture s'affiche tel
 * quel — jamais un historique partiel silencieux.
 */
function AuditTrail({ guildId, listingId }: { guildId: string; listingId: string }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [entries, setEntries] = useState<MarketListingAuditRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    function load() {
        startTransition(async () => {
            const result = await listMarketListingAuditTrail(guildId, listingId);
            if (result.success && result.data) {
                setEntries(result.data);
                setError(null);
            } else {
                setEntries(null);
                setError(result.error ?? "Historique indisponible.");
            }
        });
    }

    function toggle() {
        const next = !open;
        setOpen(next);
        if (next) load();
    }

    return (
        <div className="w-full space-y-2">
            <Button
                size="sm"
                variant="ghost"
                className="gap-2"
                disabled={isPending}
                onClick={toggle}
            >
                <History className="h-3.5 w-3.5" />
                {open ? "Masquer l’historique" : "Historique de l’annonce"}
                {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>

            {open ? (
                <div className="space-y-2 rounded-lg border border-border bg-background/40 p-2">
                    {isPending && entries === null ? (
                        <p className="text-xs text-muted-foreground">Chargement de l’historique…</p>
                    ) : null}
                    {error ? <p className="text-xs text-danger">{error}</p> : null}
                    {entries && entries.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Aucune action journalisée pour cette annonce.
                        </p>
                    ) : null}
                    {entries?.map((entry) => {
                        const detail = auditDetail(entry);
                        return (
                            <div
                                key={entry.id}
                                className="space-y-1 border-b border-border/60 pb-2 last:border-b-0 last:pb-0"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-foreground">
                                        {entry.actionLabel}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground sm:ml-auto">
                                        {new Date(entry.createdAt).toLocaleString("fr-FR", {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                        })}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    {entry.actorLabel ? `Par ${entry.actorLabel}` : "Par le système"}
                                    {detail ? ` · ${detail}` : ""}
                                </p>
                                {entry.reason ? (
                                    <p className="text-[11px] italic text-muted-foreground">« {entry.reason} »</p>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

interface WithdrawnRowProps {
    guildId: string;
    listing: MarketWithdrawnListingRecord;
    isPending: boolean;
    onRestore: (listing: MarketWithdrawnListingRecord) => void;
}

/**
 * S5.8 — ligne « annonce retirée » : contexte du retrait (origine, motif,
 * signalements ouverts) + restauration + historique d'audit.
 *
 * La restauration est bloquée **à l'écran** quand l'échéance est dépassée :
 * même règle que `restoreMarketListing`, qui reste l'autorité (§13.4).
 */
function WithdrawnRow({ guildId, listing, isPending, onRestore }: WithdrawnRowProps) {
    const withdrawnAt = listing.withdrawnAt ?? listing.updatedAt;
    const reportLabel =
        listing.openReports === 0
            ? "aucun signalement ouvert"
            : `${listing.openReports} signalement${listing.openReports > 1 ? "s" : ""} ouvert${
                  listing.openReports > 1 ? "s" : ""
              }`;

    return (
        <div className="space-y-3 rounded-xl border border-border bg-surface/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Badge
                    variant="outline"
                    className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        MARKET_STATUS_CLASSES.WITHDRAWN
                    )}
                >
                    {MARKET_STATUS_LABELS.WITHDRAWN}
                </Badge>
                <Link
                    href={`/dashboard/${guildId}/marche/${listing.id}`}
                    className="truncate text-sm font-semibold text-foreground hover:underline"
                >
                    {listing.title}
                </Link>
                <Badge variant="outline" className="text-[10px]">
                    {MARKET_TYPE_LABELS[listing.type]}
                </Badge>
                {listing.priceKamas !== null ? (
                    <span className="text-xs font-bold text-foreground">
                        {formatKamas(listing.priceKamas)}
                    </span>
                ) : null}
                <span className="text-[11px] text-muted-foreground sm:ml-auto">
                    {MARKET_WITHDRAWN_SOURCE_LABELS[listing.withdrawnSource]}
                </span>
            </div>

            <p className="text-xs text-muted-foreground">
                {listing.sellerLabel ? `Vendeur : ${listing.sellerLabel}` : "Vendeur : profil non résolu"}
                {` · retirée le ${new Date(withdrawnAt).toLocaleDateString("fr-FR")}`}
                {listing.expiresAt
                    ? ` · échéance le ${new Date(listing.expiresAt).toLocaleDateString("fr-FR")}`
                    : ""}
                {` · ${reportLabel}`}
            </p>

            {/* S8.15 — jet déclaré de l'annonce retirée (icônes officielles). */}
            {listing.stats.length > 0 ? (
                <MarketStatLines stats={listing.stats} className="mt-2" />
            ) : null}

            {listing.moderationNote ? (
                <p className="rounded-lg border border-border bg-background/40 p-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">Motif déclaré :</strong> {listing.moderationNote}
                </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={isPending || listing.restoreBlocked}
                    onClick={() => onRestore(listing)}
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Restaurer l&apos;annonce
                </Button>
                {listing.restoreBlocked ? (
                    <span className="text-[11px] text-muted-foreground">
                        Échéance dépassée : le vendeur doit la renouveler avant restauration.
                    </span>
                ) : null}
            </div>

            <AuditTrail guildId={guildId} listingId={listing.id} />
        </div>
    );
}

export function MarketModerationClient({ guildId, reports, withdrawn }: MarketModerationClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [filter, setFilter] = useState<ReportStatus | "ALL">("OPEN");
    const [tab, setTab] = useState<"REPORTS" | "WITHDRAWN">("REPORTS");

    function run(action: () => Promise<{ success: boolean; error?: string }>, successMessage: string) {
        startTransition(async () => {
            const result = await action();
            if (result.success) {
                toast.success(successMessage);
                router.refresh();
            } else {
                toast.error(result.error || "Action impossible.");
            }
        });
    }

    const counts: Record<ReportStatus, number> = {
        OPEN: reports.filter((report) => report.status === "OPEN").length,
        REVIEWED: reports.filter((report) => report.status === "REVIEWED").length,
        CLOSED: reports.filter((report) => report.status === "CLOSED").length,
    };
    const visible = filter === "ALL" ? reports : reports.filter((report) => report.status === filter);

    return (
        <div className="space-y-4" data-tour="marche-moderation">
            {/* S5.8 — deux vues : dossiers de signalement et annonces retirées. */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border p-1">
                <Button
                    size="sm"
                    variant={tab === "REPORTS" ? "secondary" : "ghost"}
                    className="h-8"
                    onClick={() => setTab("REPORTS")}
                >
                    Signalements ({reports.length})
                </Button>
                <Button
                    size="sm"
                    variant={tab === "WITHDRAWN" ? "secondary" : "ghost"}
                    className="h-8"
                    onClick={() => setTab("WITHDRAWN")}
                >
                    Annonces retirées ({withdrawn.length})
                </Button>
            </div>

            {tab === "WITHDRAWN" ? (
                withdrawn.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title="Aucune annonce retirée"
                        description="Les annonces retirées par la modération ou par leur vendeur apparaissent ici, avec l'historique complet de leurs transitions."
                    />
                ) : (
                    <div className="space-y-2">
                        {withdrawn.map((listing) => (
                            <WithdrawnRow
                                key={listing.id}
                                guildId={guildId}
                                listing={listing}
                                isPending={isPending}
                                onRestore={(row) =>
                                    run(() => restoreMarketListing(guildId, row.id), "Annonce restaurée.")
                                }
                            />
                        ))}
                    </div>
                )
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border p-1">
                        {FILTERS.map((entry) => (
                            <Button
                                key={entry.key}
                                size="sm"
                                variant={filter === entry.key ? "secondary" : "ghost"}
                                className="h-8"
                                onClick={() => setFilter(entry.key)}
                            >
                                {entry.label} ({entry.key === "ALL" ? reports.length : counts[entry.key]})
                            </Button>
                        ))}
                    </div>

                    {visible.length === 0 ? (
                        <EmptyState
                            icon={ShieldAlert}
                            title="Aucun dossier ici"
                            description="Les signalements des membres apparaissent ici, du plus récent au plus ancien, avec le contexte figé de l'annonce."
                        />
                    ) : (
                        <div className="space-y-2">
                            {visible.map((report) => (
                                <ReportRow
                                    key={report.id}
                                    guildId={guildId}
                                    report={report}
                                    isPending={isPending}
                                    onResolve={(row, status, note) =>
                                        run(
                                            () => resolveMarketReport(guildId, row.id, status, note),
                                            status === "CLOSED" ? "Dossier clôturé." : "Dossier pris en charge."
                                        )
                                    }
                                    onTakeDown={(row, note) =>
                                        run(
                                            () => takeDownMarketListing(guildId, row.listingId, note),
                                            "Annonce retirée pour modération."
                                        )
                                    }
                                    onRestore={(row) =>
                                        run(
                                            () => restoreMarketListing(guildId, row.listingId),
                                            "Annonce restaurée."
                                        )
                                    }
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
