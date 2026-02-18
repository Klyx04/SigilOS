"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveUser {
    id: string;
    name: string;
    image: string | null;
    lastActive: Date | null;
}

interface PresenceModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    users: any[];
}

export function PresenceModal({ isOpen, onOpenChange, users }: PresenceModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white uppercase tracking-widest text-sm font-black">
                        <Users className="w-4 h-4 text-indigo-400" />
                        Membres En Ligne
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {users.length > 0 ? (
                        users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className="h-10 w-10 border border-white/10 group-hover:border-emerald-500/50 transition-all">
                                            <AvatarImage src={user.image || ""} />
                                            <AvatarFallback className="bg-zinc-800 text-xs font-bold">
                                                {(user.name || "??").substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#09090b] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">{user.name}</span>
                                        <span className="text-[10px] text-zinc-500 font-medium">
                                            Actif {user.lastActive ? formatDistanceToNow(new Date(user.lastActive), { addSuffix: true, locale: fr }) : "à l'instant"}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center">
                            <p className="text-zinc-500 italic text-sm">Personne n'est connecté pour le moment.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
