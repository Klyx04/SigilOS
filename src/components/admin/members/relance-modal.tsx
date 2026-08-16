"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
    // #77 — liste des membres avec cases à cocher (on peut retirer certaines personnes
    // avant l'envoi, que ce soit en ping canal ou en MP)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(targets.map(t => t.id)));

    const selectedTargets = targets.filter(t => selectedIds.has(t.id));
    const isBulk = targets.length > 1;

    const toggleTarget = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedIds(prev => (prev.size === targets.length ? new Set<string>() : new Set(targets.map(t => t.id))));
    };

    const handleSend = () => {
        if (selectedTargets.length === 0) return toast.error("Aucun membre sélectionné");
        if (delivery === "CHANNEL" && !channelId) return toast.error("Choisissez un canal de diffusion");
        if (!message.trim()) return toast.error("Écrivez un message de relance");

        startTransition(async () => {
            const res = await sendRelance({
                guildId,
                targetUserIds: selectedTargets.map(t => t.id),
                type: delivery,
                message: message.trim(),
                channelId: delivery === "CHANNEL" ? channelId : undefined,
                criteria: undefined,
            });
            if (res.success) {
                toast.success(`Relance envoyée à ${selectedTargets.length} membre${selectedTargets.length > 1 ? "s" : ""} !`);
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
                        Ping {isBulk ? "groupé" : "solo"} de {selectedTargets.length} / {targets.length} membre{targets.length > 1 ? "s" : ""} sélectionné{selectedTargets.length > 1 ? "s" : ""}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* #77 — Liste des membres avec cases à cocher */}
                    {isBulk && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-black text-zinc-300 uppercase tracking-widest">Membres ciblés</Label>
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    className="text-caption font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                    {selectedIds.size === targets.length ? "Tout décocher" : "Tout cocher"}
                                </button>
                            </div>
                            <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/40 divide-y divide-white/5">
                                {targets.map((t) => {
                                    const checked = selectedIds.has(t.id);
                                    return (
                                        <label
                                            key={t.id}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                                                checked ? "bg-emerald-500/[0.06]" : "hover:bg-white/[0.03]"
                                            )}
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleTarget(t.id)}
                                                className={checked ? "border-emerald-500/60" : ""}
                                            />
                                            <span className={cn("text-sm truncate", checked ? "text-white" : "text-zinc-400")}>
                                                {t.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
                            {message.trim().length}/2000 — les @nickname seront remplacés par les membres sélectionnés.
                        </p>
                    </div>
                </div>

                <DialogFooter className="border-t border-white/5 pt-4 flex gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending} className="text-zinc-400 hover:text-white">
                        Annuler
                    </Button>
                    <Button onClick={handleSend} disabled={isPending || selectedTargets.length === 0}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-xs h-10 px-5 rounded-xl disabled:opacity-40">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                        Envoyer la relance
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

