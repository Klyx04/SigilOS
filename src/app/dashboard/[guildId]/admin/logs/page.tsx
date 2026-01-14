import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { getAuditLogs } from "@/server/actions/audit-actions";
import { FileText, Shield, Clock, User, Plus, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
    params: Promise<{ guildId: string }>;
};

// Action type to color mapping
const ACTION_COLORS: Record<string, string> = {
    RBAC_UPDATE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    RBAC_ROLE_ADD: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    RBAC_ROLE_REMOVE: "bg-red-500/20 text-red-400 border-red-500/30",
    CONFIG_UPDATED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    API_KEY_UPDATED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    CHANNEL_CONFIGURED: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const ACTION_LABELS: Record<string, string> = {
    RBAC_UPDATE: "Permissions modifiées",
    RBAC_ROLE_ADD: "Rôle ajouté",
    RBAC_ROLE_REMOVE: "Rôle retiré",
    CONFIG_UPDATED: "Configuration mise à jour",
    API_KEY_UPDATED: "Clé API modifiée",
    CHANNEL_CONFIGURED: "Canal configuré",
};

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(date));
}

// Type for permission change metadata
type PermissionChange = {
    roleId: string;
    added: Array<{ permission: string; label: string; module: string }>;
    removed: Array<{ permission: string; label: string; module: string }>;
};

type AuditMetadata = {
    rolesAffected?: number;
    changes?: PermissionChange[];
    timestamp?: string;
};

function PermissionChangesDisplay({ metadata }: { metadata: AuditMetadata }) {
    if (!metadata.changes || metadata.changes.length === 0) {
        return null;
    }

    return (
        <div className="mt-3 space-y-2">
            {metadata.changes.map((change, idx) => (
                <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-muted-foreground mb-2">
                        Rôle: <span className="font-mono text-foreground">{change.roleId.slice(0, 8)}...</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {change.added.map((perm, i) => (
                            <Badge key={`add-${i}`} variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                                <Plus className="w-3 h-3 mr-1" />
                                {perm.label}
                                <span className="ml-1 text-emerald-400/60 text-[10px]">({perm.module})</span>
                            </Badge>
                        ))}
                        {change.removed.map((perm, i) => (
                            <Badge key={`rem-${i}`} variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
                                <Minus className="w-3 h-3 mr-1" />
                                {perm.label}
                                <span className="ml-1 text-red-400/60 text-[10px]">({perm.module})</span>
                            </Badge>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default async function AdminLogsPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Security: Verify admin access
    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        return <AccessDenied />;
    }

    // Fetch audit logs
    const logsResult = await getAuditLogs(guildId, { limit: 100 });
    const logs = logsResult.success && logsResult.data ? logsResult.data.logs : [];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-zinc-500/20 to-zinc-500/10 border border-zinc-500/20">
                    <FileText className="h-8 w-8 text-zinc-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Logs d'Audit
                    </h1>
                    <p className="text-muted-foreground">
                        Historique des modifications administratives
                    </p>
                </div>
            </div>

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

            {/* Logs Timeline */}
            <Card className="bg-zinc-900/60 border-white/5">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Historique récent
                        {logs.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {logs.length} entrées
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    {logs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            Aucune action enregistrée pour le moment.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => {
                                const metadata = (log.metadata || {}) as AuditMetadata;

                                return (
                                    <div key={log.id} className="relative pl-6 border-l-2 border-white/10 pb-4 last:pb-0">
                                        <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-primary" />
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span className="font-semibold text-foreground">
                                                        {log.actorName}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className={ACTION_COLORS[log.action] || "bg-zinc-500/20 text-zinc-400"}
                                                    >
                                                        {ACTION_LABELS[log.action] || log.action}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {log.targetType === "PERMISSION" && "Modification des permissions RBAC"}
                                                    {log.targetType === "ROLE" && "Modification d'un rôle Discord"}
                                                    {log.targetType === "CONFIG" && "Modification de la configuration"}
                                                    {log.targetType === "CHANNEL" && "Modification d'un canal Discord"}
                                                </p>

                                                {/* Show permission changes if available */}
                                                {log.action === "RBAC_UPDATE" && metadata.changes && (
                                                    <PermissionChangesDisplay metadata={metadata} />
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(log.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
