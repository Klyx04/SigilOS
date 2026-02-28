"use client";

import { useState, useEffect, useTransition } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Share2, Users, BellOff, AtSign, Check, ChevronRight } from "lucide-react";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { publishMissionsToDiscord } from "@/server/actions/mission-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MissionDiscordPublishDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
}

type PingType = "EVERYONE" | "ROLE" | "NONE";

export function MissionDiscordPublishDialog({
    isOpen,
    onOpenChange,
    guildId
}: MissionDiscordPublishDialogProps) {
    const [pingType, setPingType] = useState<PingType>("NONE");
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [roles, setRoles] = useState<{ id: string; name: string; color: number }[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (isOpen) {
            setIsLoadingRoles(true);
            getDiscordRolesAction(guildId).then(res => {
                if (res.success && res.data) {
                    setRoles(res.data);
                }
                setIsLoadingRoles(false);
            });
        }
    }, [isOpen, guildId]);

    const handlePublish = () => {
        startTransition(async () => {
            const res = await publishMissionsToDiscord(guildId, pingType, selectedRoleId);
            if (res.success) {
                toast.success("Annonce Discord envoyée !");
                onOpenChange(false);
            } else {
                toast.error(res.error || "Erreur lors de l'envoi");
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                draggable
                className="sm:max-w-[440px] bg-zinc-950 border-white/10 shadow-2xl p-0 overflow-hidden outline-none"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 pointer-events-none" />

                <div className="p-8 pb-0 relative z-10">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner">
                                <Share2 className="w-6 h-6" />
                            </div>
                            Partager sur Discord
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 font-medium mt-2">
                            Sélectionnez qui mentionner pour cette annonce hebdomadaire.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-8 space-y-8 relative z-10">
                    {/* Main Options Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => { setPingType("NONE"); setSelectedRoleId(null); }}
                            className={cn(
                                "flex flex-col items-start gap-4 p-5 rounded-3xl border-2 transition-all duration-500 text-left relative overflow-hidden group",
                                pingType === "NONE"
                                    ? "bg-zinc-900 border-indigo-500 shadow-[0_0_30px_-5px_rgba(99,102,241,0.4)]"
                                    : "bg-zinc-900/40 border-white/5 hover:border-white/20"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-xl transition-all duration-500",
                                pingType === "NONE" ? "bg-indigo-500 text-white scale-110 shadow-lg" : "bg-zinc-800 text-zinc-500 group-hover:text-zinc-300"
                            )}>
                                <BellOff className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-sm font-black text-white uppercase tracking-widest">Sans ping</div>
                                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mt-0.5">Annonce discrète</div>
                            </div>
                            {pingType === "NONE" && (
                                <div className="absolute top-3 right-3 animate-in zoom-in duration-300">
                                    <div className="bg-indigo-500 rounded-full p-0.5">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                            )}
                        </button>

                        <button
                            onClick={() => { setPingType("EVERYONE"); setSelectedRoleId(null); }}
                            className={cn(
                                "flex flex-col items-start gap-4 p-5 rounded-3xl border-2 transition-all duration-500 text-left relative overflow-hidden group",
                                pingType === "EVERYONE"
                                    ? "bg-zinc-900 border-red-500 shadow-[0_0_30px_-5px_rgba(239,68,68,0.4)]"
                                    : "bg-zinc-900/40 border-white/5 hover:border-white/20"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-xl transition-all duration-500",
                                pingType === "EVERYONE" ? "bg-red-500 text-white scale-110 shadow-lg" : "bg-zinc-800 text-zinc-500 group-hover:text-zinc-300"
                            )}>
                                <AtSign className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-sm font-black text-white uppercase tracking-widest">@everyone</div>
                                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mt-0.5">Toute la guilde</div>
                            </div>
                            {pingType === "EVERYONE" && (
                                <div className="absolute top-3 right-3 animate-in zoom-in duration-300">
                                    <div className="bg-red-500 rounded-full p-0.5">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Role Selection Label */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
                                Ou mentionner un rôle :
                            </label>
                            {selectedRoleId && (
                                <button
                                    onClick={() => setSelectedRoleId(null)}
                                    className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    Effacer
                                </button>
                            )}
                        </div>

                        <div className="bg-zinc-900/60 border border-white/5 rounded-3xl overflow-hidden shadow-inner font-bold tracking-tight">
                            <ScrollArea className="h-[200px] w-full">
                                {isLoadingRoles ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 py-10 opacity-50">
                                        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Chargement des rôles...</span>
                                    </div>
                                ) : roles.length === 0 ? (
                                    <div className="px-6 py-10 text-center">
                                        <span className="text-xs text-zinc-600">Aucun rôle trouvé</span>
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-1">
                                        {roles.map(role => (
                                            <button
                                                key={role.id}
                                                onClick={() => {
                                                    setPingType("ROLE");
                                                    setSelectedRoleId(role.id);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 group relative",
                                                    selectedRoleId === role.id
                                                        ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-100"
                                                        : "hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_var(--role-color)]"
                                                        style={{
                                                            backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#71717a',
                                                            '--role-color': role.color ? `#${role.color.toString(16).padStart(6, '0')}44` : '#71717a44'
                                                        } as React.CSSProperties}
                                                    />
                                                    <span className="text-sm font-bold truncate max-w-[280px]">@{role.name}</span>
                                                </div>
                                                {selectedRoleId === role.id ? (
                                                    <Check className="w-4 h-4 text-indigo-400" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-zinc-700 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-2 relative z-10">
                    <Button
                        onClick={handlePublish}
                        disabled={isPending}
                        className={cn(
                            "w-full h-16 rounded-[2rem] font-black text-lg uppercase tracking-[0.15em] transition-all duration-700 shadow-2xl relative group overflow-hidden border-t border-white/10",
                            pingType === "NONE" && "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30",
                            pingType === "EVERYONE" && "bg-red-600 hover:bg-red-500 shadow-red-600/30",
                            pingType === "ROLE" && "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30"
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        {isPending ? (
                            <Loader2 className="w-7 h-7 animate-spin mr-3" />
                        ) : (
                            <Send className="w-5 h-5 mr-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                        )}
                        <span className="relative z-10">Envoyer sur Discord</span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
