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
import Link from "next/link";
import { useParams } from "next/navigation";

interface ActiveUser {
    id: string;
    name: string;
    image: string | null;
    lastActive: Date | null;
    isAfk?: boolean;
}

interface PresenceModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    users: ActiveUser[];
}

export function PresenceModal({ isOpen, onOpenChange, users }: PresenceModalProps) {
    const { guildId } = useParams() as { guildId: string };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white uppercase tracking-widest text-sm font-black">
                        <Users className="w-4 h-4 text-indigo-400" />
                        Membres En Ligne ({users.length})
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-2.5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {users.length > 0 ? (
                        users.map((user) => {
                            const lastActiveDate = user.lastActive ? new Date(user.lastActive) : null;
                            const diffMinutes = lastActiveDate ? (Date.now() - lastActiveDate.getTime()) / 60000 : 0;
                            const isAfk = user.isAfk || diffMinutes > 15;

                            return (
                                <div key={user.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar className={`h-10 w-10 border transition-all ${isAfk ? 'border-amber-500/40 group-hover:border-amber-400' : 'border-white/10 group-hover:border-emerald-500/50'}`}>
                                                <AvatarImage src={user.image || ""} />
                                                <AvatarFallback className="bg-zinc-800 text-xs font-bold">
                                                    {(user.name || "??").substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* Status Indicator Light: Yellow/Amber if AFK > 15min, Green if Active <= 15min */}
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-[#09090b] rounded-full transition-all ${
                                                isAfk 
                                                    ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]' 
                                                    : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
                                            }`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <Link href={`/dashboard/${guildId}/members/${user.id}`} onClick={() => onOpenChange(false)}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors cursor-pointer hover:underline">{user.name}</span>
                                                    {isAfk && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20">
                                                            AFK
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
                                            <span className={`text-[10px] font-medium ${isAfk ? 'text-amber-400/80' : 'text-zinc-500'}`}>
                                                {isAfk 
                                                    ? (lastActiveDate ? `AFK depuis ${formatDistanceToNow(lastActiveDate, { locale: fr })}` : "AFK (> 15 min)")
                                                    : (lastActiveDate ? `Actif ${formatDistanceToNow(lastActiveDate, { addSuffix: true, locale: fr })}` : "Actif à l'instant")
                                                }
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`h-2 w-2 rounded-full animate-pulse ${isAfk ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                                </div>
                            );
                        })
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
