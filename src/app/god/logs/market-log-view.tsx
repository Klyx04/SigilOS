"use client";

/**
 * God « Audit Logs » — onglet **Marché**.
 *
 * 🧭 Déplacé depuis la page de supervision Marché (décision user du 18/09/2026) :
 * le journal d'audit du marché est un **journal** comme les autres, sa place est
 * ici — la page Marché ne garde que la supervision (indicateurs, santé Discord,
 * preuves & médias, réglages globaux).
 *
 * Lecture seule : la liste vient de `listGodMarketAuditLogs` (**super-admin
 * fail-closed côté serveur**) et le filtre n'envoie qu'un **id interne** de
 * guilde (`GuildConfig.id`), jamais un snowflake. Les dates sont formatées en
 * UTC par le helper **partagé** du module (`formatMarketDateTime`) : aucun
 * `toLocaleString`, donc aucun écart d'hydratation serveur/navigateur.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMarketDateTime } from "@/lib/market/format-date";
import { listGodMarketAuditLogs, type GodMarketLogRow } from "@/server/actions/god-market-actions";

/** Borne d'affichage réelle : la page affiche au plus 50 entrées à la fois. */
const MARKET_LOG_PAGE = 50;

export function MarketLogView({
    initialLogs,
    guilds,
}: {
    initialLogs: GodMarketLogRow[];
    guilds: { id: string; name: string }[];
}) {
    const [logs, setLogs] = useState<GodMarketLogRow[]>(initialLogs);
    const [guildConfigId, setGuildConfigId] = useState("");
    const [isPending, startTransition] = useTransition();

    /** Recharge le journal (filtre optionnel par **id interne** de guilde). */
    function load(nextGuildId: string) {
        setGuildConfigId(nextGuildId);
        startTransition(async () => {
            const result = await listGodMarketAuditLogs(
                nextGuildId ? { guildConfigId: nextGuildId, limit: MARKET_LOG_PAGE } : { limit: MARKET_LOG_PAGE }
            );
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            setLogs(result.data);
        });
    }

    return (
        <div className="rounded-2xl border border-border bg-surface/40 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold text-foreground">Journal du Marché</h2>
                    <span className="text-caption px-2 py-0.5 rounded-full border border-border text-muted-foreground tabular-nums">
                        {logs.length} entrée(s)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        className="h-9 min-w-[200px] rounded-xl border border-border bg-surface px-3 text-body-sm text-foreground"
                        value={guildConfigId}
                        onChange={(event) => load(event.target.value)}
                        disabled={isPending}
                        aria-label="Filtrer le journal du marché par guilde"
                    >
                        <option value="">Toutes les guildes</option>
                        {guilds.map((guild) => (
                            <option key={guild.id} value={guild.id}>
                                {guild.name}
                            </option>
                        ))}
                    </select>
                    <Button variant="outline" size="sm" onClick={() => load(guildConfigId)} disabled={isPending}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Actualiser
                    </Button>
                </div>
            </div>

            <p className="text-caption text-muted-foreground">
                Chaque transition du marché est horodatée : annonces (publication, retrait, archivage, rappels),
                réservations et offres, signalements, synchronisation Discord et configuration. La conservation suit
                « Rétention du journal » (God → Marché). Dates affichées en UTC.
            </p>

            {logs.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="Aucune action journalisée"
                    description="Le marché n'a pas encore d'activité sur ce périmètre."
                />
            ) : (
                <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                    {logs.map((log) => (
                        <li key={log.id} className="p-3 flex flex-wrap items-center gap-3">
                            <span className="font-mono text-caption text-muted-foreground w-32 shrink-0">
                                {formatMarketDateTime(log.createdAt)}
                            </span>
                            <span className="font-medium text-foreground">{log.actionLabel}</span>
                            {/* `min-w-0` + `flex-1` : la ligne se **rétrécit** au lieu de
                                déborder (un nom de guilde ou un motif long ne pousse
                                jamais la page horizontalement). */}
                            <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
                                {log.guildName ?? "Guilde inconnue"}
                                {log.reason ? ` · ${log.reason}` : ""}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
