"use client";

/**
 * Panneau de modération du Marché (S4.11, `market:moderate`).
 *
 * Écran **privé** : il liste les dossiers de signalement de la guilde, permet de
 * les classer (en cours / clôturé + note de résolution) et d'agir sur l'annonce
 * (retrait pour modération, restauration). Aucune règle métier ici : chaque
 * action est déléguée à `market-admin-actions` (§13.4), la liste vient du
 * serveur (`listMarketReports`).
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
} from "@/server/actions/market-constants";
import { formatKamas } from "@/lib/market/kamas";
import { cn } from "@/lib/utils";
import { resolveMarketReport, restoreMarketListing, takeDownMarketListing } from "@/server/actions/market-admin-actions";
import { toast } from "sonner";
import { Check, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

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
    createdAt: string;
    reviewedAt: string | null;
};

interface MarketModerationClientProps {
    guildId: string;
    reports: MarketReportRow[];
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
        </div>
    );
}

export function MarketModerationClient({ guildId, reports }: MarketModerationClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [filter, setFilter] = useState<ReportStatus | "ALL">("OPEN");

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
        <div className="space-y-4">
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
                                run(() => restoreMarketListing(guildId, row.listingId), "Annonce restaurée.")
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
