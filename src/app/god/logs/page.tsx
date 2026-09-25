import { Suspense } from "react";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";
import { getGlobalAuditLogs } from "@/server/actions/audit-actions";
import { getRecentAccessAttempts } from "@/server/actions/super-admin-actions";
import { listGodMarketAuditLogs, listGodMarketGuilds } from "@/server/actions/god-market-actions";
import { Shield } from "lucide-react";
import { LogsTabs } from "./logs-tabs";

export default async function GodLogsPage() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    const { data } = await getGlobalAuditLogs({ limit: 50 });
    const attemptsRes = await getRecentAccessAttempts(50);

    // 🧭 Onglet « Marché » (déplacé depuis God → Marché, décision user 18/09/2026) :
    // journal d'audit du module + guildes **internes** pour le filtre. Les deux
    // lectures sont gardées super-admin côté action (fail-closed).
    const [marketLogsRes, marketGuildsRes] = await Promise.all([
        listGodMarketAuditLogs({ limit: 50 }),
        listGodMarketGuilds(),
    ]);

    // 🧹 La purge n'est PLUS déclenchée ici : `/god/logs` n'est pas un cron.
    // Avant l'audit du 24/09, chaque visite lançait `cleanupGlobalAuditLogs()` en
    // fire-and-forget (un `deleteMany` global sans lot) — et c'était l'un des deux
    // appelants qui justifiait d'avoir retiré la garde d'accès de la fonction.
    // La purge vit désormais dans le core `src/server/audit-retention.ts`, appelé
    // par le cron `/api/cron/cleanup-logs` (90 j God / 30 j guilde, par lot).

    return (
        <div className="space-y-8 py-8">
            <div className="flex flex-col gap-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-caption font-semibold text-emerald-400 uppercase tracking-wider w-fit">
                    <Shield className="w-3 h-3" />
                    Journal plateforme
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                    Audit Logs
                </h1>
                <p className="text-zinc-500 max-w-2xl font-medium">
                    Historique complet des actions administratives et des événements de sécurité sur l'ensemble de la
                    plateforme, y compris le journal d'audit du Marché (annonces, réservations, offres, signalements).
                </p>
                <p className="text-xs text-zinc-600 max-w-2xl">
                    Rétention : <span className="text-zinc-400">90 jours</span> pour les actions plateforme (God),
                    <span className="text-zinc-400"> 30 jours</span> pour les journaux de guilde — purge quotidienne
                    par le cron <code className="text-zinc-500">cleanup-logs</code>.
                </p>
            </div>

            <Suspense fallback={<div className="h-96 animate-pulse bg-zinc-900/50 rounded-2xl border border-white/5" />}>
                <LogsTabs
                    attempts={attemptsRes.data?.attempts || []}
                    attemptsTotal={attemptsRes.data?.total || 0}
                    initialLogs={data?.logs || []}
                    initialTotal={data?.total || 0}
                    marketLogs={marketLogsRes.success ? marketLogsRes.data : []}
                    marketGuilds={marketGuildsRes.success ? marketGuildsRes.data : []}
                />
            </Suspense>
        </div>
    );
}
