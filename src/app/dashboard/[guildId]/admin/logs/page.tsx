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
    // retention policy is now 7 days
    cleanupOldAuditLogs(guildId).catch(err =>
        console.error("[LazyCleanup] Failed to clean old logs:", err)
    );

    // Fetch audit logs (initial page)
    const logsResult = await getAuditLogs(guildId, { limit: 20, page: 1 });
    const logs = logsResult.success && logsResult.data ? logsResult.data.logs : [];
    const total = logsResult.success && logsResult.data ? logsResult.data.total : 0;

    // Fetch Discord roles to get role names
    let roleNames: Record<string, string> = {};
    try {
        const roles = await fetchGuildRoles(guildId);
        roles.forEach(role => {
            roleNames[role.id] = role.name;
        });
    } catch (error) {
        console.error("[AdminLogs] Failed to fetch role names:", error);
    }

    // Convert dates to strings for client component
    const serializedLogs = logs.map(log => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
        metadata: log.metadata as any,
    }));

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Logs d'Audit"
                description="Historique des modifications administratives"
                icon={FileText}
                backHref={`/dashboard/${guildId}/admin`}
            />

            {/* Security Notice */}
            <Card className="bg-amber-500/10 border-amber-500/20">
                <CardContent className="p-4 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200">
                        <strong>Logs immutables</strong> — Ces entrées ne peuvent pas être modifiées ou supprimées.
                        Chaque action administrative est enregistrée de manière permanente.
                    </p>
                </CardContent>
            </Card>

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

