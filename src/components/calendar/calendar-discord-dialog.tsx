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
import { Loader2, Send, Share2, Users, BellOff, AtSign, Check, ChevronRight, Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiscordRole {
    id: string;
    name: string;
    color?: number;
}

interface CalendarDiscordDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
    eventId: string;
    roles: DiscordRole[];
    mode: "REMINDER" | "SHARE";
    onConfirm: (roleId?: string | "everyone") => Promise<{ success: boolean; sentCount?: number; discordSent?: boolean; error?: string }>;
}

type PingType = "EVERYONE" | "ROLE" | "NONE";

export function CalendarDiscordDialog({
    isOpen,
    onOpenChange,
    guildId,
    eventId,
    roles,
    mode,
    onConfirm
}: CalendarDiscordDialogProps) {
    const [pingType, setPingType] = useState<PingType>("NONE");
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const isReminder = mode === "REMINDER";

    const handleConfirm = () => {
        startTransition(async () => {
            const roleId = pingType === "EVERYONE" ? "everyone" : (pingType === "ROLE" ? selectedRoleId || undefined : undefined);
            const res = await onConfirm(roleId);

            if (res.success) {
                if (isReminder) {
                    let msg = `Rappel envoyé à ${res.sentCount} participants`;
                    if (res.discordSent) msg += " et publié sur Discord";
                    toast.success(msg);
                } else {
                    toast.success("Événement partagé sur Discord !");
                }
                onOpenChange(false);
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                draggable
                className="sm:max-w-[500px] bg-zinc-950 border-white/10 shadow-2xl p-0 overflow-hidden outline-none"
            >
                <div className={cn(
                    "absolute inset-0 pointer-events-none",
                    isReminder
                        ? "bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10"
                        : "bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10"
                )} />

                <div className="p-8 pb-0 relative z-10">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                            <div className={cn(
                                "p-2.5 rounded-2xl shadow-inner",
                                isReminder ? "bg-amber-500/20 text-amber-400" : "bg-indigo-500/20 text-indigo-400"
                            )}>
                                {isReminder ? <Bell className="w-6 h-6" /> : <Share2 className="w-6 h-6" />}
                            </div>
                            {isReminder ? "Envoyer un rappel" : "Partager sur Discord"}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 font-medium mt-2">
                            {isReminder
                                ? "Notifiez les participants de l'événement avec un ping optionnel."
                                : "Sélectionnez qui mentionner pour cette annonce d'événement."
                            }
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
                                    ? cn("bg-zinc-900", isReminder ? "border-amber-500 shadow-[0_0_30px_-5px_rgba(245,158,11,0.4)]" : "border-indigo-500 shadow-[0_0_30px_-5px_rgba(99,102,241,0.4)]")
                                    : "bg-zinc-900/40 border-white/5 hover:border-white/20"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-xl transition-all duration-500",
                                pingType === "NONE"
                                    ? (isReminder ? "bg-amber-500" : "bg-indigo-500") + " text-white scale-110 shadow-lg"
                                    : "bg-zinc-800 text-zinc-500 group-hover:text-zinc-300"
                            )}>
                                {isReminder ? <Users className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="text-sm font-black text-white uppercase tracking-widest">
                                    {isReminder ? "Participants" : "Sans ping"}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mt-0.5">
                                    {isReminder ? "App uniquement" : "Annonce discrète"}
                                </div>
                            </div>
                            {pingType === "NONE" && (
                                <div className="absolute top-3 right-3 animate-in zoom-in duration-300">
                                    <div className={cn("rounded-full p-0.5", isReminder ? "bg-amber-500" : "bg-indigo-500")}>
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
                                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mt-0.5">
                                    {isReminder ? "App + Discord" : "Toute la guilde"}
                                </div>
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
                                Ou pinger un rôle Discord :
                            </label>
                            {selectedRoleId && (
                                <button
                                    onClick={() => setSelectedRoleId(null)}
                                    className={cn(
                                        "text-[10px] font-black uppercase tracking-widest transition-colors",
                                        isReminder ? "text-amber-400 hover:text-amber-300" : "text-indigo-400 hover:text-indigo-300"
                                    )}
                                >
                                    Effacer
                                </button>
                            )}
                        </div>

                        <div className="bg-zinc-900/60 border border-white/5 rounded-3xl overflow-hidden shadow-inner font-bold tracking-tight">
                            <ScrollArea className="h-[180px] w-full">
                                {roles.length === 0 ? (
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
                                                        ? (isReminder ? "bg-amber-500/10 border-amber-500/20 text-amber-100" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-100")
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
                                                    <Check className={cn("w-4 h-4", isReminder ? "text-amber-400" : "text-indigo-400")} />
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
                        onClick={handleConfirm}
                        disabled={isPending}
                        className={cn(
                            "w-full h-16 rounded-[2rem] font-black text-lg uppercase tracking-[0.15em] transition-all duration-700 shadow-2xl relative group overflow-hidden border-t border-white/10",
                            pingType === "NONE" && (isReminder ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"),
                            pingType === "EVERYONE" && "bg-red-600 hover:bg-red-500 shadow-red-600/30",
                            pingType === "ROLE" && (isReminder ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30")
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        {isPending ? (
                            <Loader2 className="w-7 h-7 animate-spin mr-3" />
                        ) : (
                            <Send className="w-5 h-5 mr-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                        )}
                        <span className="relative z-10">
                            {isReminder ? "Envoyer le rappel" : "Envoyer sur Discord"}
                        </span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
