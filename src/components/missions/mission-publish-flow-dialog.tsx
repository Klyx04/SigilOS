"use client";

import { useState, useEffect, useTransition } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    Loader2, 
    Send, 
    Share2, 
    BellOff, 
    AtSign, 
    Check, 
    AlertTriangle, 
    ChevronRight, 
    ChevronLeft,
    Rocket,
    Save
} from "lucide-react";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { publishMissionsToDiscord } from "@/server/actions/mission-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MissionPublishFlowDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
    missionPool: 'CLASSIQUES' | 'SPECIALES';
    missionsCount: number;
    onConfirm: () => Promise<{ success: boolean; error?: string }>;
    isDiscordConfigured?: boolean;
}

type Step = "CONFIRM" | "DISCORD_PING";
type PingType = "EVERYONE" | "ROLE" | "NONE";

export function MissionPublishFlowDialog({
    isOpen,
    onOpenChange,
    guildId,
    missionPool,
    missionsCount,
    onConfirm,
    isDiscordConfigured = true
}: MissionPublishFlowDialogProps) {
    const [step, setStep] = useState<Step>("CONFIRM");
    const [pingType, setPingType] = useState<PingType>("NONE");
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [roles, setRoles] = useState<{ id: string; name: string; color: number }[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishingDiscord, setIsPublishingDiscord] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep("CONFIRM");
            setIsLoadingRoles(true);
            // Apply the admin's ping whitelist (legacy allowedPingRoleIds) — same for
            // members and admins. (ignoreWhitelist is only used in admin settings panels.)
            getDiscordRolesAction(guildId, { context: "legacy" }).then(res => {
                if (res.success && res.roles) setRoles(res.roles);
                setIsLoadingRoles(false);
            });
        }
    }, [isOpen, guildId]);

    const isPoolComplete = missionPool === 'CLASSIQUES' ? missionsCount === 12 : missionsCount >= 1;

    const handleSaveAndNext = async () => {
        if (!isPoolComplete) return;
        setIsSaving(true);
        const res = await onConfirm();
        setIsSaving(false);
        
        if (res.success) {
            if (!isDiscordConfigured) {
                toast.success("Publication terminée !");
                onOpenChange(false);
            } else {
                setStep("DISCORD_PING");
            }
        }
    };

    const handleFinalize = async (skipDiscord = false) => {
        if (skipDiscord) {
            toast.success("Publication terminée !");
            onOpenChange(false);
            return;
        }

        setIsPublishingDiscord(true);
        const res = await publishMissionsToDiscord(guildId, pingType, selectedRoleId);
        setIsPublishingDiscord(false);
        
        if (res.success) {
            toast.success("Publication terminée et annonce Discord envoyée !");
            onOpenChange(false);
        } else {
            toast.error(res.error || "Missions sauvegardées mais erreur d'annonce Discord.");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-zinc-950 border-white/10 shadow-2xl rounded-3xl p-0 overflow-hidden outline-none">
                
                {/* STEP INDICATOR */}
                <div className="flex h-1 bg-white/5">
                    <div className={cn("h-full bg-indigo-500 transition-all duration-500", step === "CONFIRM" ? "w-1/2" : "w-full")} />
                </div>

                {/* CONTENT AREA */}
                <div className="p-6">
                    {step === "CONFIRM" ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500">
                                        <Save className="w-5 h-5" />
                                    </div>
                                    Publication Dashboard
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 text-sm mt-2">
                                    Vous allez mettre à jour les missions {missionPool === 'CLASSIQUES' ? 'Classiques' : 'Spéciales'} sur le site.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-400 font-bold">Pool de missions</span>
                                    <span className={cn(
                                        "font-black uppercase tracking-widest px-2 py-1 rounded text-[10px]",
                                        missionPool === 'CLASSIQUES' ? "bg-indigo-500/20 text-indigo-400" : "bg-yellow-500/20 text-yellow-500"
                                    )}>
                                        {missionPool}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3">
                                    <span className="text-zinc-400 font-bold">État de configuration</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "font-mono font-black text-sm",
                                            isPoolComplete ? "text-emerald-400" : "text-rose-500"
                                        )}>
                                            {missionsCount} / {missionPool === 'CLASSIQUES' ? 12 : 6}
                                        </span>
                                        {isPoolComplete ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                                    </div>
                                </div>
                                
                                {!isPoolComplete && (
                                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2 text-[10px] text-rose-400 font-bold leading-tight">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        {missionPool === 'CLASSIQUES' 
                                            ? "ERREUR : Les 12 missions classiques doivent être configurées pour permettre la publication hebdomadaire." 
                                            : "ERREUR : Configurez au moins une mission spéciale avant de publier."}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button 
                                    onClick={handleSaveAndNext} 
                                    disabled={isSaving || !isPoolComplete}
                                    className={cn(
                                        "h-12 font-black rounded-2xl shadow-xl transition-all",
                                        isPoolComplete 
                                            ? "bg-white text-black hover:bg-zinc-200 shadow-white/5" 
                                            : "bg-zinc-900 text-zinc-700 cursor-not-allowed grayscale"
                                    )}
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "PUBLIER & CONTINUER"}
                                    {!isSaving && <ChevronRight className="w-5 h-5 ml-2" />}
                                </Button>
                                <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-500 hover:text-white h-10 font-bold">
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                                        <Send className="w-5 h-5" />
                                    </div>
                                    Annonce Discord
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 text-sm mt-2">
                                    Missions sauvegardées avec succès ! Souhaitez-vous notifier la guilde ?
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setPingType("NONE"); setSelectedRoleId(null); }}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group",
                                        pingType === "NONE"
                                            ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                                            : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10"
                                    )}
                                >
                                    <BellOff className={cn("w-5 h-5", pingType === "NONE" ? "text-indigo-400" : "text-zinc-600 group-hover:text-zinc-400")} />
                                    <span className="text-xs font-black uppercase tracking-widest">Sans Ping</span>
                                </button>
                                <button
                                    onClick={() => { setPingType("EVERYONE"); setSelectedRoleId(null); }}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group",
                                        pingType === "EVERYONE"
                                            ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                                            : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10"
                                    )}
                                >
                                    <AtSign className={cn("w-5 h-5", pingType === "EVERYONE" ? "text-rose-400" : "text-zinc-600 group-hover:text-zinc-400")} />
                                    <span className="text-xs font-black uppercase tracking-widest">@everyone</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Ping un rôle spécifique</label>
                                <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden max-h-40 overflow-y-auto custom-scrollbar shadow-inner">
                                    {isLoadingRoles ? (
                                        <div className="flex items-center justify-center py-8 gap-2 text-zinc-600">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        </div>
                                    ) : roles.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-zinc-600 italic">Aucun rôle trouvé</div>
                                    ) : (
                                        <div className="p-2 space-y-1">
                                            {roles.map(role => {
                                                const isSelected = selectedRoleId === role.id;
                                                const hex = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#71717a";
                                                return (
                                                    <button
                                                        key={role.id}
                                                        onClick={() => { setPingType("ROLE"); setSelectedRoleId(role.id); }}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                                                            isSelected ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-400 hover:bg-white/5"
                                                        )}
                                                    >
                                                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: hex }} />
                                                        <span className="text-sm font-bold flex-1 truncate">@{role.name}</span>
                                                        {isSelected && <Check className="w-4 h-4" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <Button 
                                    onClick={() => handleFinalize(false)} 
                                    disabled={isPublishingDiscord}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white h-12 font-black rounded-2xl shadow-xl shadow-indigo-500/20"
                                >
                                    {isPublishingDiscord ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Rocket className="w-5 h-5 mr-2" />}
                                    FINALISER & ENVOYER
                                </Button>
                                <button 
                                    onClick={() => handleFinalize(true)}
                                    className="h-10 text-xs font-bold text-zinc-600 hover:text-rose-400 transition-colors uppercase tracking-wider"
                                >
                                    Ignorer l'annonce Discord
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
