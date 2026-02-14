import { Suspense } from "react";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";
import { LogViewer } from "./log-viewer";
import { getGlobalAuditLogs } from "@/server/actions/audit-actions";
import { Shield } from "lucide-react";

export default async function GodLogsPage() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    const { data } = await getGlobalAuditLogs({ limit: 50 });

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

            <Suspense fallback={<div className="h-96 animate-pulse bg-zinc-900/50 rounded-2xl border border-white/5" />}>
                <LogViewer initialLogs={data?.logs || []} initialTotal={data?.total || 0} />
            </Suspense>
        </div>
    );
}
