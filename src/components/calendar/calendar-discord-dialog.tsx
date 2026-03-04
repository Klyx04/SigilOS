"use client";

import { useState, useTransition } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Share2, Bell, BellOff, AtSign, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
            <DialogContent className="max-w-xs sm:max-w-sm bg-zinc-950 border-white/10 shadow-2xl rounded-2xl p-0 overflow-hidden outline-none">
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-white/5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-white flex items-center gap-2.5">
                            <div className={cn(
                                "p-1.5 rounded-xl",
                                isReminder ? "bg-amber-500/20 text-amber-400" : "bg-indigo-500/20 text-indigo-400"
                            )}>
                                {isReminder ? <Bell className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                            </div>
                            {isReminder ? "Envoyer un rappel" : "Partager sur Discord"}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-xs mt-1">
                            {isReminder
                                ? "Notifiez les participants avec un ping optionnel."
                                : "Qui mentionner pour cette annonce d'événement ?"
                            }
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Mode: 2 compact buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* Option 1: Sans ping / Participants seulement */}
                        <button
                            onClick={() => { setPingType("NONE"); setSelectedRoleId(null); }}
                            className={cn(
                                "flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left",
                                pingType === "NONE"
                                    ? isReminder
                                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                                        : "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                                    : "bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                            )}
                        >
                            {isReminder ? <Users className="w-4 h-4 shrink-0" /> : <BellOff className="w-4 h-4 shrink-0" />}
                            <div>
                                <div className="text-xs font-black">{isReminder ? "Participants" : "Sans ping"}</div>
                                <div className="text-[10px] text-zinc-600 font-medium">{isReminder ? "App seulement" : "Discret"}</div>
                            </div>
                            {pingType === "NONE" && <Check className={cn("w-3.5 h-3.5 ml-auto", isReminder ? "text-amber-400" : "text-indigo-400")} />}
                        </button>

                        {/* Option 2: @everyone */}
                        <button
                            onClick={() => { setPingType("EVERYONE"); setSelectedRoleId(null); }}
                            className={cn(
                                "flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left",
                                pingType === "EVERYONE"
                                    ? "bg-red-500/10 border-red-500/40 text-red-300"
                                    : "bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                            )}
                        >
                            <AtSign className="w-4 h-4 shrink-0" />
                            <div>
                                <div className="text-xs font-black">@everyone</div>
                                <div className="text-[10px] text-zinc-600 font-medium">{isReminder ? "App + Discord" : "Toute la guilde"}</div>
                            </div>
                            {pingType === "EVERYONE" && <Check className="w-3.5 h-3.5 ml-auto text-red-400" />}
                        </button>
                    </div>

                    {/* Role list */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ou un rôle spécifique</span>
                            {selectedRoleId && (
                                <button
                                    onClick={() => { setSelectedRoleId(null); if (pingType === "ROLE") setPingType("NONE"); }}
                                    className={cn(
                                        "text-[10px] font-bold transition-colors",
                                        isReminder ? "text-amber-400 hover:text-amber-300" : "text-indigo-400 hover:text-indigo-300"
                                    )}
                                >
                                    Effacer
                                </button>
                            )}
                        </div>

                        <div className="bg-zinc-900/80 border border-white/5 rounded-xl overflow-hidden max-h-40 overflow-y-auto custom-scrollbar">
                            {roles.length === 0 ? (
                                <div className="py-6 text-center text-xs text-zinc-600">Aucun rôle trouvé</div>
                            ) : (
                                <div className="p-1.5 space-y-0.5">
                                    {roles.map(role => {
                                        const hex = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#71717a";
                                        const isSelected = selectedRoleId === role.id;
                                        return (
                                            <button
                                                key={role.id}
                                                onClick={() => { setPingType("ROLE"); setSelectedRoleId(role.id); }}
                                                className={cn(
                                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all",
                                                    isSelected
                                                        ? isReminder
                                                            ? "bg-amber-500/10 text-amber-100"
                                                            : "bg-indigo-500/10 text-indigo-100"
                                                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                                )}
                                            >
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                                                <span className="text-sm font-bold truncate flex-1">@{role.name}</span>
                                                {isSelected && (
                                                    <Check className={cn("w-3.5 h-3.5 shrink-0", isReminder ? "text-amber-400" : "text-indigo-400")} />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5">
                    <Button
                        onClick={handleConfirm}
                        disabled={isPending}
                        className={cn(
                            "w-full h-10 font-black text-sm transition-all",
                            pingType === "EVERYONE"
                                ? "bg-red-600 hover:bg-red-500"
                                : isReminder
                                    ? "bg-amber-600 hover:bg-amber-500"
                                    : "bg-indigo-600 hover:bg-indigo-500"
                        )}
                    >
                        {isPending
                            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            : <Send className="w-4 h-4 mr-2" />
                        }
                        {isReminder ? "Envoyer le rappel" : "Envoyer sur Discord"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
