import { getPendingDeletionUsers } from "@/server/actions/super-admin-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, Trash2, UserX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * [ADM-8] God Dashboard — Panel listant tous les utilisateurs en attente de suppression de compte (platform-wide).
 * Affiché dans l'onglet Sécurité du god dashboard.
 */
export async function DeletionPendingPanel() {
    const users = await getPendingDeletionUsers();

    return (
        <div className="bg-zinc-900/10 border border-white/5 rounded-3xl p-8 backdrop-blur-xl h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <UserX className={`w-4 h-4 ${users.length > 0 ? "text-amber-400" : "text-zinc-600"}`} />
                    Comptes (Plateforme)
                </h3>
                <span className={`text-xs px-3 py-1 rounded-full font-black tracking-widest border ${users.length === 0
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    }`}>
                    {users.length === 0 ? "✓ Aucune" : `${users.length}`}
                </span>
            </div>

            {users.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-emerald-300">Aucun compte en attente de suppression</p>
                        <p className="text-xs text-zinc-500">La plateforme est propre.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {users.map((user) => {
                        const deletionDate = user.scheduledDeletion || user.deletionRequestedAt;
                        const isPast = deletionDate ? new Date(deletionDate) < new Date() : false;

                        return (
                            <div
                                key={user.id}
                                className="flex items-start gap-4 p-4 rounded-xl border bg-amber-950/10 border-amber-500/15 hover:border-amber-500/25 transition-colors"
                            >
                                <Avatar className="h-9 w-9 border border-amber-500/20 shrink-0 mt-0.5">
                                    <AvatarImage src={user.image || undefined} />
                                    <AvatarFallback className="bg-zinc-900 text-amber-400 text-xs font-black">
                                        {(user.name || "?").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0 space-y-1">
                                    {/* Name + guilds */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm text-white truncate">
                                            {user.name || "Utilisateur inconnu"}
                                        </span>
                                        {user.guilds.map((g, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="text-[9px] shrink-0 border-zinc-700/50 text-zinc-500 bg-zinc-800/50"
                                            >
                                                {g.guildName}
                                                {g.displayName && g.displayName !== user.name ? ` · ${g.displayName}` : ""}
                                            </Badge>
                                        ))}
                                        {user.guilds.length === 0 && (
                                            <Badge variant="outline" className="text-[9px] border-zinc-700/50 text-zinc-600 bg-zinc-800/50">
                                                Aucun profil guilde
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Timing info */}
                                    <div className="flex items-center gap-4 flex-wrap">
                                        {user.deletionRequestedAt && (
                                            <span className="flex items-center gap-1 text-xs text-zinc-500">
                                                <UserX className="w-3 h-3 text-amber-400 shrink-0" />
                                                Demandé {formatDistanceToNow(new Date(user.deletionRequestedAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        )}
                                        {user.scheduledDeletion && (
                                            <span className={`flex items-center gap-1 text-xs font-semibold ${isPast ? "text-rose-400" : "text-orange-400"}`}>
                                                <Clock className="w-3 h-3 shrink-0" />
                                                {isPast
                                                    ? `Janitor en attente — dépassé ${formatDistanceToNow(new Date(user.scheduledDeletion), { addSuffix: true, locale: fr })}`
                                                    : `Suppression dans ${formatDistanceToNow(new Date(user.scheduledDeletion), { locale: fr })}`
                                                }
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Status indicator */}
                                <div className={`shrink-0 mt-2 w-1.5 h-1.5 rounded-full ${isPast
                                        ? "bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                                        : "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.4)]"
                                    }`} />
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest pt-2 border-t border-white/5">
                Soft-delete — suppression définitive exécutée par le Janitor au-delà du délai de rétention
            </p>
        </div>
    );
}
