"use client";

/**
 * Onglet **Accès délégués** (A10) — le journal `GodAccessLog` était **écrit et
 * jamais lu** (mesure du 25/09/2026 : 55 lignes — 20 GRANT, 28 REVOKE, 7 SYNC).
 *
 * Lecture **super-admin** (fail-closed dans l'action `getGodAccessLogs`), paginée
 * et regroupée par jour UTC comme les autres journaux. Aucune action ici : cet
 * onglet ne fait que rendre visible ce que la plateforme écrit déjà.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGodAccessLogs, type GodAccessLogEntry } from "@/server/actions/audit-actions";
import {
    AUDIT_LOG_PAGE_SIZES,
    DEFAULT_AUDIT_LOG_PAGE_SIZE,
    groupLogsByDay,
    totalPagesOf,
} from "@/lib/audit-log-view";
import { GodEmptyState, GodLoadingSkeleton, GodPagination } from "../ui";

const ACTION_LABELS: Record<string, string> = {
    GRANT: "Accès accordé",
    REVOKE: "Accès révoqué",
    SYNC: "Accès synchronisé",
};

export function DelegatedAccessView({
    initialLogs,
    initialTotal,
}: {
    initialLogs: GodAccessLogEntry[];
    initialTotal: number;
}) {
    const [logs, setLogs] = useState<GodAccessLogEntry[]>(initialLogs);
    const [total, setTotal] = useState(initialTotal);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(DEFAULT_AUDIT_LOG_PAGE_SIZE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const firstRun = useRef(true);

    const totalPages = totalPagesOf(total, pageSize);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getGodAccessLogs({ page, limit: pageSize });
            if (!result.success || !result.data) {
                setError(result.error ?? "Journal des accès délégués indisponible.");
                return;
            }
            setLogs(result.data.logs);
            setTotal(result.data.total);
        } catch {
            setError("Journal des accès délégués indisponible (réseau).");
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        void fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        setPage(1);
    }, [pageSize]);

    const groups = groupLogsByDay(logs, (log) => log.createdAt);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/40 px-4 py-3">
                <span className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <span className="tabular-nums">{total}</span> accès délégué(s) journalisé(s)
                </span>
                <span className="text-caption text-muted-foreground">
                    Délégations et briques (accord, révocation, synchronisation). Rétention 90 j.
                </span>
                <Button variant="outline" size="sm" onClick={() => void fetchLogs()} disabled={loading} className="h-9 text-caption">
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Actualiser
                </Button>
            </div>

            {error ? (
                <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-body-sm text-danger">
                    {error}
                </div>
            ) : loading ? (
                <GodLoadingSkeleton rows={5} />
            ) : logs.length === 0 ? (
                <GodEmptyState
                    icon={KeyRound}
                    title="Aucun accès délégué"
                    description="Aucune délégation n'a encore été accordée, révoquée ou synchronisée."
                />
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <table className="w-full border-collapse text-left">
                        <thead className="bg-elevated/60">
                            <tr>
                                <th className="px-6 py-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                                <th className="px-6 py-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">Délégué</th>
                                <th className="px-6 py-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">Détail</th>
                                <th className="px-6 py-3 text-right text-caption font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                            </tr>
                        </thead>
                        {groups.map((group) => (
                            <tbody key={group.key}>
                                <tr className="bg-elevated/40">
                                    <td colSpan={4} className="px-6 py-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                        {group.label} · <span className="tabular-nums">{group.rows.length}</span> entrée(s)
                                    </td>
                                </tr>
                                {group.rows.map((log) => (
                                    <tr key={log.id} className="border-t border-border/60 align-top">
                                        <td className="px-6 py-3">
                                            <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-caption font-bold text-info">
                                                {ACTION_LABELS[log.action] ?? log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-body-sm text-foreground">{log.userName ?? "Compte inconnu"}</td>
                                        <td className="px-6 py-3 text-caption text-muted-foreground">
                                            {log.detail ?? "—"}
                                            {log.targetId ? (
                                                <span className="mt-0.5 block truncate font-mono text-caption text-muted-foreground">{log.targetId}</span>
                                            ) : null}
                                        </td>
                                        <td className="px-6 py-3 text-right text-caption text-muted-foreground">
                                            <span title={new Date(log.createdAt).toISOString()}>
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        ))}
                    </table>
                </div>
            )}

            <GodPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
                pageSize={pageSize}
                pageSizes={AUDIT_LOG_PAGE_SIZES}
                onPageSizeChange={setPageSize}
                disabled={loading}
            />
        </div>
    );
}
