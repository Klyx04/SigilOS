"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sendRelance } from "@/server/actions/relance-actions";
import { toast } from "sonner";
import { Bell, Loader2, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RelanceTarget {
    id: string; // Discord ID (snowflake)
    name: string; // Pseudo affiché (@nickname)
}

interface RelanceModalProps {
    guildId: string;
    targets: RelanceTarget[];
    channels: any[];
    onClose: () => void;
}

/** Chantier #74 — interface dédiée « Relancer » : ping @nickname solo/bulk, message dédié, canal ou MP. */
export function RelanceModal({ guildId, targets, channels, onClose }: RelanceModalProps) {
    const [message, setMessage] = useState("");
    const [delivery, setDelivery] = useState<"CHANNEL" | "DM">("CHANNEL");
    const [channelId, setChannelId] = useState<string>("");
    const [isPending, startTransition] = useTransition();

    const targetNames = targets.map(t => `@${t.name}`).join(", ");
    const isBulk = targets.length > 1;

    const handleSend = () => {
        if (targets.length === 0) return toast.error("Aucun membre sélectionné");
        if (delivery === "CHANNEL" && !channelId) return toast.error("Choisissez un canal de diffusion");
        if (!message.trim()) return toast.error("Écrivez un message de relance");

        startTransition(async () => {
            const res = await sendRelance({
                guildId,
                targetUserIds: targets.map(t => t.id),
                type: delivery,
                message: message.trim(),
                channelId: delivery === "CHANNEL" ? channelId : undefined,
                criteria: undefined,
            });
            if (res.success) {
                toast.success(`Relance envoyée à ${targets.length} membre${targets.length > 1 ? "s" : ""} !`);
                onClose();
            } else {
                toast.error(res.error || "Erreur lors de l'envoi");
            }
        });
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg bg-zinc-950 border-white/10 rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <Bell className="w-5 h-5 text-amber-400" />
                        Relancer {isBulk ? "la sélection" : "ce membre"}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        Ping {isBulk ? "groupé" : "solo"} de {targets.length} membre{targets.length > 1 ? "s" : ""} —{" "}
                        <span className="text-amber-400 font-medium">{targetNames}</span>
                    </DialogDescription>
                </DialogHeader>


                <div className="space-y-5 py-2">
                    <div className="space-y-2">
                        <Label className="text-xs font-black text-zinc-300 uppercase tracking-widest">Livraison</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setDelivery("CHANNEL")}
                                className={cn("p-3 rounded-xl border text-left transition-colors",
                                    delivery === "CHANNEL" ? "bg-amber-500/10 border-amber-500/40" : "bg-zinc-900/40 border-white/10 hover:border-white/20")}>
                                <span className="flex items-center gap-2 text-sm font-bold text-white">
                                    <Send className="w-4 h-4 text-amber-400" /> Canal
                                </span>
                                <span className="text-caption text-zinc-500 mt-1 block">Message public dans un salon (@mention)</span>
                            </button>
                            <button type="button" onClick={() => setDelivery("DM")}
                                className={cn("p-3 rounded-xl border text-left transition-colors",
                                    delivery === "DM" ? "bg-indigo-500/10 border-indigo-500/40" : "bg-zinc-900/40 border-white/10 hover:border-white/20")}>
                                <span className="flex items-center gap-2 text-sm font-bold text-white">
                                    <Users className="w-4 h-4 text-indigo-400" /> Message privé
                                </span>
                                <span className="text-caption text-zinc-500 mt-1 block">MP via le bot Discord (pas de ping public)</span>
                            </button>
                        </div>
                    </div>

                    {delivery === "CHANNEL" && (
                        <div className="space-y-2">
                            <Label className="text-xs font-black text-zinc-300 uppercase tracking-widest">Canal de diffusion</Label>
                            <Select value={channelId} onValueChange={setChannelId}>
                                <SelectTrigger className="h-11 bg-zinc-900/50 border-white/10 text-sm">
                                    <SelectValue placeholder="Choisir un salon..." />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-white/10">
                                    {channels.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-zinc-500">Aucun canal disponible.</div>
                                    )}
                                    {channels.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id} className="text-sm"># {ch.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-xs font-black text-zinc-300 uppercase tracking-widest">Message de relance</Label>
                        <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
                            placeholder="Salut @nickname ! Pense à valider tes missions cette semaine..."
                            rows={4} className="bg-zinc-900/50 border-white/10 text-sm resize-none" />
                        <p className="text-caption text-zinc-600">
                            {message.trim().length}/2000 — les @nickname seront remplacés par les membres ciblés.
                        </p>
                    </div>
                </div>

                <DialogFooter className="border-t border-white/5 pt-4 flex gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending} className="text-zinc-400 hover:text-white">
                        Annuler
                    </Button>
                    <Button onClick={handleSend} disabled={isPending}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-xs h-10 px-5 rounded-xl">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                        Envoyer la relance
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

