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
import { Loader2, Send, Share2, BellOff, AtSign, Check } from "lucide-react";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { publishMissionsToDiscord } from "@/server/actions/mission-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
                if (res.success && res.data) setRoles(res.data);
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

    const accentColor = pingType === "EVERYONE" ? "red" : "indigo";

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xs sm:max-w-sm bg-zinc-950 border-white/10 shadow-2xl rounded-2xl p-0 overflow-hidden outline-none">
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-white/5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-white flex items-center gap-2.5">
                            <div className="p-1.5 bg-indigo-500/20 rounded-xl text-indigo-400">
                                <Share2 className="w-4 h-4" />
                            </div>
                            Partager sur Discord
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-xs mt-1">
                            Qui mentionner pour cette annonce hebdomadaire ?
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Mode selector: 2 compact buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* Sans ping */}
                        <button
                            onClick={() => { setPingType("NONE"); setSelectedRoleId(null); }}
                            className={cn(
                                "flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left",
                                pingType === "NONE"
                                    ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                                    : "bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                            )}
                        >
                            <BellOff className="w-4 h-4 shrink-0" />
                            <div>
                                <div className="text-xs font-black">Sans ping</div>
                                <div className="text-[10px] text-zinc-600 font-medium">Discret</div>
                            </div>
                            {pingType === "NONE" && <Check className="w-3.5 h-3.5 ml-auto text-indigo-400" />}
                        </button>

                        {/* @everyone */}
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
                                <div className="text-[10px] text-zinc-600 font-medium">Toute la guilde</div>
                            </div>
                            {pingType === "EVERYONE" && <Check className="w-3.5 h-3.5 ml-auto text-red-400" />}
                        </button>
                    </div>

                    {/* Role List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ou un rôle spécifique</span>
                            {selectedRoleId && (
                                <button
                                    onClick={() => { setSelectedRoleId(null); if (pingType === "ROLE") setPingType("NONE"); }}
                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                                >
                                    Effacer
                                </button>
                            )}
                        </div>

                        <div className="bg-zinc-900/80 border border-white/5 rounded-xl overflow-hidden max-h-44 overflow-y-auto custom-scrollbar">
                            {isLoadingRoles ? (
                                <div className="flex items-center justify-center py-6 gap-2 text-zinc-600">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-xs">Chargement…</span>
                                </div>
                            ) : roles.length === 0 ? (
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
                                                        ? "bg-indigo-500/10 text-indigo-100"
                                                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                                )}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: hex }}
                                                />
                                                <span className="text-sm font-bold truncate flex-1">@{role.name}</span>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
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
                        onClick={handlePublish}
                        disabled={isPending}
                        className={cn(
                            "w-full h-10 font-black text-sm transition-all",
                            pingType === "EVERYONE"
                                ? "bg-red-600 hover:bg-red-500"
                                : "bg-indigo-600 hover:bg-indigo-500"
                        )}
                    >
                        {isPending
                            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            : <Send className="w-4 h-4 mr-2" />
                        }
                        Envoyer sur Discord
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
