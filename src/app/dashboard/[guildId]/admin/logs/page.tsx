import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { getAuditLogs, logAdminAccessDenied, cleanupOldAuditLogs } from "@/server/actions/audit-actions";
import { fetchGuildRoles } from "@/server/discord";
import { FileText, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AuditLogsClient } from "./_components/audit-logs-client";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function AdminLogsPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Security: Verify admin access + Audit Log
    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        await logAdminAccessDenied(guildId, "/admin/logs");
        return <AccessDenied />;
    }

    // Lazy Cleanup: Trigger automatic cleanup of old logs (fire & forget)
    // Retention policy is exactly 30 days (consistent with UI notice)
    cleanupOldAuditLogs(guildId).catch(err =>
        console.error("[LazyCleanup] Failed to clean old logs:", err)
    );

    // Fetch audit logs (initial page)
    const logsResult = await getAuditLogs(guildId, { limit: 20, page: 1 });
    const logs = logsResult.success && logsResult.data ? logsResult.data.logs : [];
    const total = logsResult.success && logsResult.data ? logsResult.data.total : 0;

    // Fetch Discord roles to get role names
    const roleNames: Record<string, string> = {};
    try {
        const roles = await fetchGuildRoles(guildId);
        roles.forEach(role => {
            roleNames[role.id] = role.name;
        });
    } catch (error) {
        console.error("[AdminLogs] Failed to fetch role names:", error);
    }

    // Convert dates and BigInts for client component
    const serializedLogs = logs.map(log => {
        // Handle BigInts in metadata/oldValue/newValue (Prisma Json fields)
        const stringify = (val: any) => {
            if (!val) return val;
            return JSON.parse(JSON.stringify(val, (_, v) => 
                typeof v === 'bigint' ? v.toString() : v
            ));
        };

        return {
            ...log,
            createdAt: log.createdAt.toISOString(),
            metadata: stringify(log.metadata),
            oldValue: stringify(log.oldValue),
            newValue: stringify(log.newValue),
        };
    });

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Logs d'Audit"
                description="Historique des modifications administratives"
                icon={FileText}
                backHref={`/dashboard/${guildId}/admin`}
            />

            {/* Security Notice */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex items-start gap-4 mb-8">
                    <Shield className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
                    <div>
                        <h2 className="text-amber-500 font-black uppercase tracking-wider mb-1">Journal de Transparence</h2>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Ces entrées sont enregistrées pour garantir la sécurité de la guilde et la traçabilité des actions administratives. 
                            Conformément à notre politique de confidentialité, ces journaux sont <strong>automatiquement supprimés après 30 jours</strong>.
                        </p>
                    </div>
                </div>

            {/* Logs Timeline - Client Component */}
            <AuditLogsClient
                guildId={guildId}
                initialLogs={serializedLogs}
                initialTotal={total}
                roleNames={roleNames}
            />
        </div>
    );
}

