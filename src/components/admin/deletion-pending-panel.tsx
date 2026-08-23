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
        <div className="bg-surface/10 border border-border rounded-3xl p-8 backdrop-blur-xl h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <UserX className={`w-4 h-4 ${users.length > 0 ? "text-warning" : "text-muted-foreground"}`} />
                    Comptes (Plateforme)
                </h3>
                <span className={`text-xs px-3 py-1 rounded-full font-black tracking-widest border ${users.length === 0
                        ? "bg-success/10 border-success/20 text-success"
                        : "bg-warning/10 border-warning/20 text-warning"
                    }`}>
                    {users.length === 0 ? "✓ Aucune" : `${users.length}`}
                </span>
            </div>

            {users.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-success/5 border border-success/10">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4 text-success" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-success">Aucun compte en attente de suppression</p>
                        <p className="text-xs text-muted-foreground">La plateforme est propre.</p>
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
                                className="flex items-start gap-4 p-4 rounded-xl border bg-warning/10 border-warning/15 hover:border-warning/25 transition-colors"
                            >
                                <Avatar className="h-9 w-9 border border-warning/20 shrink-0 mt-0.5">
                                    <AvatarImage src={user.image || undefined} />
                                    <AvatarFallback className="bg-surface text-warning text-xs font-black">
                                        {(user.name || "?").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0 space-y-1">
                                    {/* Name + guilds */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm text-foreground truncate">
                                            {user.name || "Utilisateur inconnu"}
                                        </span>
                                        {user.guilds.map((g, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="text-caption shrink-0 border-border/50 text-muted-foreground bg-elevated/50"
                                            >
                                                {g.guildName}
                                                {g.displayName && g.displayName !== user.name ? ` · ${g.displayName}` : ""}
                                            </Badge>
                                        ))}
                                        {user.guilds.length === 0 && (
                                            <Badge variant="outline" className="text-caption border-border/50 text-muted-foreground bg-elevated/50">
                                                Aucun profil guilde
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Timing info */}
                                    <div className="flex items-center gap-4 flex-wrap">
                                        {user.deletionRequestedAt && (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <UserX className="w-3 h-3 text-warning shrink-0" />
                                                Demandé {formatDistanceToNow(new Date(user.deletionRequestedAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        )}
                                        {user.scheduledDeletion && (
                                            <span className={`flex items-center gap-1 text-xs font-semibold ${isPast ? "text-danger" : "text-warning"}`}>
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
                                        ? "bg-danger animate-pulse "
                                        : "bg-warning "
                                    }`} />
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest pt-2 border-t border-border">
                Soft-delete — suppression définitive exécutée par le Janitor au-delà du délai de rétention
            </p>
        </div>
    );
}
