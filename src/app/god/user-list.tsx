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
            toast.success("Utilisateur supprimé (Fantôme exorcisé).");
            router.refresh();
        } else {
            toast.error("Erreur lors de la suppression.");
        }
    };

    if (users.length === 0) {
        return <div className="text-zinc-500 text-sm italic">Aucun fantôme détecté. La base est propre.</div>;
    }

    return (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between border p-3 rounded-lg group transition-colors bg-red-950/10 border-red-900/20 hover:border-red-900/40">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-zinc-700">
                            <AvatarImage src={user.image || undefined} />
                            <AvatarFallback>{user.name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-medium text-white flex items-center gap-2">
                                {user.name}
                                <Badge variant="outline" className="text-caption py-0 h-5 border-zinc-500/30 text-zinc-400 bg-zinc-500/10">
                                    Sans Profil
                                </Badge>
                            </div>
                            <div className="text-xs text-zinc-500">
                                Inscrit {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: fr })}
                            </div>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <div>
                            <div className="text-xs font-medium text-red-400">
                                Cible Janitor
                            </div>
                            <div className="text-caption text-zinc-600 font-mono mt-1">
                                {user.id.slice(0, 8)}...
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.id, user.name || "?")}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                            title="Exorciser manuellement"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
