"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { History, ShieldCheck } from "lucide-react";
import { getActivityLogs } from "@/server/actions/activity-log-actions";

type LogEntry = Awaited<ReturnType<typeof getActivityLogs>>[number];

const ACTION_STYLES: Record<string, { color: string; label: string; icon: string }> = {
    CREATED: { color: "text-emerald-400", label: "Créé", icon: "✨" },
    UPDATED: { color: "text-cyan-400", label: "Modifié", icon: "📝" },
    DELETED: { color: "text-rose-400", label: "Supprimé", icon: "🗑" },
    STATUS_CHANGE: { color: "text-amber-400", label: "Statut", icon: "🔄" },
    RETURNED: { color: "text-emerald-400", label: "Rendu", icon: "✅" },
    PARTIAL_RETURN: { color: "text-amber-400", label: "Partiel", icon: "⏳" },
    CANCELLED: { color: "text-zinc-400", label: "Annulé", icon: "❌" },
};

function getName(a: LogEntry["actor"]) {
    return a.pseudoDofus || a.discordNickname || a.user?.name || "Membre";
}

interface ActivityTimelineProps {
    entityId: string;
    guildId: string;
    trigger?: React.ReactNode;
}

export function ActivityTimeline({ entityId, guildId, trigger }: ActivityTimelineProps) {
    const [open, setOpen] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        getActivityLogs(guildId, entityId)
            .then(setLogs)
            .finally(() => setLoading(false));
    }, [open, guildId, entityId]);

    return (
        <>
            {trigger ? (
                <div onClick={() => setOpen(true)} className="cursor-pointer">{trigger}</div>
            ) : (
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpen(true)}
                    className="h-7 text-xs text-zinc-500 hover:text-cyan-400 gap-1"
                >
                    <History className="h-3 w-3" />
                    Historique
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-cyan-400" />
                            Journal d&apos;activité
                        </DialogTitle>
                        <p className="text-[11px] text-zinc-500 mt-1">
                            Enregistrement immuable — ne peut être ni modifié ni supprimé.
                        </p>
                    </DialogHeader>

                    <div className="max-h-[400px] overflow-y-auto space-y-0 py-2">
                        {loading ? (
                            <div className="text-center py-8 text-zinc-500 text-xs">Chargement...</div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500 text-xs">Aucun historique.</div>
                        ) : (
                            logs.map((log, i) => {
                                const style = ACTION_STYLES[log.action] || ACTION_STYLES.CREATED;
                                const name = getName(log.actor);
                                const isLast = i === logs.length - 1;

                                return (
                                    <div key={log.id} className="flex gap-3 relative">
                                        {/* Timeline line */}
                                        {!isLast && (
                                            <div className="absolute left-[11px] top-8 bottom-0 w-px bg-white/5" />
                                        )}

                                        {/* Dot */}
                                        <div className="shrink-0 mt-1.5">
                                            <div className={`w-[22px] h-[22px] rounded-full border ${style.color.replace("text-", "border-")}/30 bg-zinc-900 flex items-center justify-center text-[10px]`}>
                                                {style.icon}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 pb-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${style.color}`}>{style.label}</span>
                                                <span className="text-[10px] text-zinc-600">
                                                    {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                                                        day: "numeric",
                                                        month: "short",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-300 mt-0.5">{log.summary}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Avatar className="h-4 w-4 rounded">
                                                    <AvatarImage src={log.actor.user?.image || undefined} />
                                                    <AvatarFallback className="text-[7px] bg-zinc-800">
                                                        {name.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] text-zinc-500">{name}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
