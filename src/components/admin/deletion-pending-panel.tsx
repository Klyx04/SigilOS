import { getDeletionPendingMembers } from "@/server/actions/user-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Trash2, UserX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface DeletionPendingPanelProps {
    guildId: string;
}

export async function DeletionPendingPanel({ guildId }: DeletionPendingPanelProps) {
    const result = await getDeletionPendingMembers(guildId);
    const members = result.data ?? [];

    if (!result.success) {
        return (
            <div className="flex items-center gap-2 text-sm text-zinc-500 italic">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Impossible de charger les données de suppression.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <UserX className="w-4 h-4 text-rose-400" />
                        Comptes en cours de suppression
                    </h3>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        Membres ayant demandé la suppression de leur compte SigilOS.
                    </p>
                </div>
                <Badge
                    variant="outline"
                    className={
                        members.length === 0
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : "border-rose-500/30 text-rose-400 bg-rose-500/10"
                    }
                >
                    {members.length === 0 ? "✓ Aucun en attente" : `${members.length} en attente`}
                </Badge>
            </div>

            {members.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-emerald-300">Aucune suppression en attente</p>
                        <p className="text-xs text-zinc-500">Tous les comptes de cette guilde sont actifs.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    {members.map((member) => {
                        const isScheduled = !!member.scheduledDeletion;
                        const deletionDate = member.scheduledDeletion || member.deletionRequestedAt;
                        const isPast = deletionDate ? new Date(deletionDate) < new Date() : false;

                        return (
                            <div
                                key={member.profileId}
                                className="flex items-center gap-4 p-4 rounded-xl border bg-rose-950/10 border-rose-500/20 hover:border-rose-500/30 transition-colors"
                            >
                                {/* Avatar */}
                                <Avatar className="h-10 w-10 border border-rose-500/20 shrink-0">
                                    <AvatarImage src={member.image || undefined} />
                                    <AvatarFallback className="bg-zinc-900 text-rose-400 text-xs font-black">
                                        {member.displayName.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm text-white truncate">
                                            {member.displayName}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] shrink-0 border-zinc-700/50 text-zinc-500 bg-zinc-800/50"
                                        >
                                            {member.profileStatus}
                                        </Badge>
                                        {member.archiveReason && (
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] shrink-0 border-amber-500/20 text-amber-400 bg-amber-500/5"
                                            >
                                                {member.archiveReason.replace(/_/g, " ")}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        {member.deletionRequestedAt && (
                                            <span className="flex items-center gap-1 text-xs text-zinc-500">
                                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                                Demandé {formatDistanceToNow(new Date(member.deletionRequestedAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        )}
                                        {member.scheduledDeletion && (
                                            <span className={`flex items-center gap-1 text-xs font-semibold ${isPast ? "text-rose-400" : "text-orange-400"}`}>
                                                <Clock className="w-3 h-3 shrink-0" />
                                                {isPast
                                                    ? `Suppression programmée (dépassée — ${formatDistanceToNow(new Date(member.scheduledDeletion), { addSuffix: true, locale: fr })})`
                                                    : `Suppression dans ${formatDistanceToNow(new Date(member.scheduledDeletion), { locale: fr })}`
                                                }
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Status dot */}
                                <div className={`shrink-0 w-2 h-2 rounded-full ${isPast ? "bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]"}`} />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer note */}
            <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest">
                La suppression définitive est exécutée automatiquement par le Janitor après le délai de rétention.
            </p>
        </div>
    );
}
