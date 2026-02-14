"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
    History,
    User,
    Building2,
    AlertCircle,
    Key,
    Settings,
    Search,
    ChevronLeft,
    ChevronRight,
    Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AuditLog {
    id: string;
    actorUserId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string | null;
    oldValue: any;
    newValue: any;
    metadata: any;
    createdAt: Date;
    guild?: {
        name: string;
        discordGuildId: string;
    };
}

interface LogViewerProps {
    initialLogs: AuditLog[];
    initialTotal: number;
}

export function LogViewer({ initialLogs, initialTotal }: LogViewerProps) {
    const [logs, setLogs] = useState(initialLogs);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const getActionIcon = (action: string) => {
        if (action.includes("RBAC")) return <Key className="w-4 h-4 text-amber-400" />;
        if (action.includes("SECURITY")) return <AlertCircle className="w-4 h-4 text-red-500" />;
        if (action.includes("CONFIG")) return <Settings className="w-4 h-4 text-blue-400" />;
        return <Terminal className="w-4 h-4 text-zinc-400" />;
    };

    const formatValue = (val: any) => {
        if (!val || typeof val !== "object") return String(val);
        return JSON.stringify(val, null, 2);
    };

    return (
        <div className="space-y-4">
            {/* Table */}
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Événement</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Acteur</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cible / Guilde</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Détails</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-20 text-center text-zinc-600 font-medium">
                                    Aucun log détecté dans la base de données.
                                </td>
                            </tr>
                        ) : logs.map((log) => (
                            <tr key={log.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-zinc-800/50 border border-white/5 group-hover:border-white/10 transition-colors">
                                            {getActionIcon(log.action)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-zinc-200 uppercase tracking-tight">{log.action.replace(/_/g, " ")}</span>
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{log.targetType}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                                            <User className="w-3 h-3 text-violet-400" />
                                        </div>
                                        <span className="text-sm font-medium text-zinc-300">{log.actorName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-3 h-3 text-zinc-600" />
                                            <span className="text-sm font-medium text-zinc-400">{log.guild?.name || "Global / System"}</span>
                                        </div>
                                        {log.targetId && (
                                            <span className="text-[10px] font-mono text-zinc-600 ml-5">{log.targetId}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {log.metadata && (
                                        <div className="max-w-xs truncate text-xs text-zinc-500 font-mono italic">
                                            {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="text-sm font-medium text-zinc-400">
                                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Placeholder */}
            {initialTotal > 50 && (
                <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-widest px-2">
                    <span>Affichage de 1 à {logs.length} sur {initialTotal} entrées</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled className="bg-zinc-900 border-white/5 text-zinc-500">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" disabled className="bg-zinc-900 border-white/5 text-zinc-500">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
