"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Send, Users, AlertTriangle } from "lucide-react";
import { sendDjCustomReminder } from "@/server/actions/dungeon-finder-actions";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";

interface DjReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: DjPostWithDetails;
    guildId: string;
}

export function DjReminderModal({ isOpen, onClose, post, guildId }: DjReminderModalProps) {
    const [message, setMessage] = useState("");
    const [isPending, startTransition] = useTransition();

    const acceptedParticipants = post.participants.filter(p => p.status === "ACCEPTED");
    const MAX_CHARS = 500;
    const remaining = MAX_CHARS - message.length;

    // Check if 24h cooldown is still active
    const canSend = !post.lastReminderAt ||
        (Date.now() - new Date(post.lastReminderAt).getTime()) >= 24 * 60 * 60 * 1000;

    const cooldownHoursLeft = post.lastReminderAt
        ? Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - new Date(post.lastReminderAt).getTime())) / 3600000)
        : 0;

    function handleSend() {
        if (!message.trim()) {
            toast.error("Le message ne peut pas être vide.");
            return;
        }
        startTransition(async () => {
            const res = await sendDjCustomReminder(guildId, post.id, message);
            if (res.success) {
                toast.success("📣 Relance envoyée sur Discord !");
                setMessage("");
                onClose();
            } else {
                toast.error(res.error || "Erreur lors de l'envoi de la relance.");
            }
        });
    }

    function handleClose() {
        if (!isPending) {
            setMessage("");
            onClose();
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="w-[95vw] max-w-lg bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl text-white p-0 gap-0">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                            <Bell className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-black text-white">
                                Envoyer une relance
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 mt-0.5">
                                Pinge les participants acceptés sur Discord
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    {/* Participants to ping */}
                    <div className="bg-slate-900/50 rounded-xl p-3.5 border border-white/5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
                                Participants à pinger
                            </p>
                            <p className="text-sm font-bold text-white mt-0.5">
                                {acceptedParticipants.length > 0
                                    ? `${acceptedParticipants.length} participant${acceptedParticipants.length > 1 ? "s" : ""} accepté${acceptedParticipants.length > 1 ? "s" : ""}`
                                    : "Aucun participant accepté"
                                }
                            </p>
                        </div>
                    </div>

                    {/* Cooldown warning */}
                    {!canSend && (
                        <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-3.5 flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <p className="text-sm text-rose-300">
                                Anti-spam : prochaine relance possible dans <strong>{cooldownHoursLeft}h</strong>.
                            </p>
                        </div>
                    )}

                    {/* Message input */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                Message libre
                            </label>
                            <span className={`text-[10px] font-bold tabular-nums ${remaining < 50 ? "text-rose-400" : "text-slate-600"}`}>
                                {remaining}/{MAX_CHARS}
                            </span>
                        </div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                            placeholder="Ex: On se retrouve à 20h sur le serveur, préparez votre stuff farm !"
                            rows={4}
                            className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 resize-none transition-all"
                            disabled={isPending || !canSend}
                        />
                        <p className="text-[11px] text-slate-600">
                            Ce message sera envoyé en embed Discord avec vos infos de leader.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            className="flex-1 border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 font-bold h-11"
                            onClick={handleClose}
                            disabled={isPending}
                        >
                            Annuler
                        </Button>
                        <Button
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black h-11 shadow-lg shadow-amber-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            onClick={handleSend}
                            disabled={isPending || !canSend || !message.trim() || acceptedParticipants.length === 0}
                        >
                            <Send className="w-4 h-4 mr-2" />
                            {isPending ? "Envoi..." : "Envoyer la relance"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
