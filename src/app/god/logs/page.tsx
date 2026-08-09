import { Suspense } from "react";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";
import { LogViewer } from "./log-viewer";
import { getGlobalAuditLogs } from "@/server/actions/audit-actions";
import { Shield } from "lucide-react";
import { getRecentAccessAttempts } from "@/server/actions/super-admin-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default async function GodLogsPage() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    const { data } = await getGlobalAuditLogs({ limit: 50 });
    const attemptsRes = await getRecentAccessAttempts(50);

    // 🧹 Maintenance: Trigger background cleanup of old platform logs (30d retention)
    const { cleanupGlobalAuditLogs } = await import("@/server/actions/audit-actions");
    cleanupGlobalAuditLogs().catch(err => console.error("[PlatformCleanup] Failed:", err));

    const reasonLabels: Record<string, string> = {
        NO_MANAGED_GUILD: "Aucune guilde gérée / whitelistée",
        DISCORD_API_ERROR: "API Discord indisponible (pas de profil connu)",
    };

    return (
        <div className="space-y-8 py-8">
            <div className="flex flex-col gap-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-black text-violet-400 uppercase tracking-widest w-fit">
                    <Shield className="w-3 h-3" />
                    Archive Système
                </div>
                <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
                    Audit Logs
                </h1>
                <p className="text-zinc-500 max-w-2xl font-medium">
                    Historique complet des actions administratives et des événements de sécurité sur l'ensemble de la plateforme.
                </p>
            </div>

            {/* Tentatives de connexion refusées (observabilité God, fail-closed) */}
            <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-rose-400" />
                        <h2 className="text-lg font-bold text-white">
                            Tentatives de connexion refusées
                        </h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-white/5 text-zinc-400">
                            {attemptsRes.data?.total ?? 0} au total
                        </span>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                        Candidats ayant cliqué « Se connecter » sans être dans une guilde gérée. Rétention 90 jours.
                    </span>
                </div>

                {!attemptsRes.success || !attemptsRes.data?.attempts?.length ? (
                    <p className="text-sm text-zinc-500 italic">Aucune tentative refusée enregistrée.</p>
                ) : (
                    <ul className="divide-y divide-white/5 text-sm">
                        {attemptsRes.data.attempts.map(a => (
                            <li key={a.id} className="py-2.5 flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-xs text-zinc-300 truncate">
                                        Discord ID: {a.discordId}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 ml-auto">
                                    <span className="text-xs text-rose-300/90">
                                        {reasonLabels[a.reason] || a.reason}
                                    </span>
                                    <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: fr })}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Suspense fallback={<div className="h-96 animate-pulse bg-zinc-900/50 rounded-2xl border border-white/5" />}>
                <LogViewer initialLogs={data?.logs || []} initialTotal={data?.total || 0} />
            </Suspense>
        </div>
    );
}
