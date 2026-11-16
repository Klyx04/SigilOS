"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { forceDeleteUser } from "@/server/actions/super-admin-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface UserListProps {
    users: Array<{
        id: string;
        name: string | null;
        image: string | null;
        createdAt: Date;
        accounts: Array<{ provider: string }>;
    }>;
}

export function UserList({ users }: UserListProps) {
    const router = useRouter();

    const handleDelete = async (userId: string, userName: string) => {
        if (!confirm(`Voulez-vous vraiment supprimer définitivement l'utilisateur ${userName || "Inconnu"} ? Cette action est irréversible.`)) {
            return;
        }

        const result = await forceDeleteUser(userId);
        if (result.success) {
            toast.success("Compte supprimé.");
            router.refresh();
        } else {
            toast.error("Erreur lors de la suppression.");
        }
    };

    if (users.length === 0) {
        return <div className="text-sm text-muted-foreground">Aucun compte sans profil détecté. La base est propre.</div>;
    }

    return (
        <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/10 p-3 transition-colors hover:border-border-strong">
                    <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-xl border border-border">
                            <AvatarImage src={user.image || undefined} />
                            <AvatarFallback className="rounded-xl bg-elevated text-xs font-semibold text-muted-foreground">
                                {user.name?.[0] || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                {user.name}
                                <Badge variant="outline" className="h-5 border-border bg-surface/10 px-2 py-0 text-xs font-medium text-muted-foreground">
                                    Sans profil
                                </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Inscrit {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: fr })}
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <div className="hidden text-right sm:block">
                            <div className="text-xs font-medium text-warning">Cible du nettoyage</div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">
                                {user.id.slice(0, 8)}…
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.id, user.name || "?")}
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Supprimer ce compte"
                            aria-label={`Supprimer ${user.name || "ce compte"}`}
                        >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
