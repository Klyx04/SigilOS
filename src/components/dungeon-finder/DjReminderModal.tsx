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
            <DialogContent className="w-[95vw] max-w-lg bg-background border border-border shadow-2xl rounded-2xl text-foreground p-0 gap-0">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/25 flex items-center justify-center shrink-0">
                            <Bell className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-black text-foreground">
                                Envoyer une relance
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Pinge les participants acceptés sur Discord
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    {/* Participants to ping */}
                    <div className="bg-surface/50 rounded-xl p-3.5 border border-border flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-info" />
                        </div>
                        <div>
                            <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">
                                Participants à pinger
                            </p>
                            <p className="text-sm font-bold text-foreground mt-0.5">
                                {acceptedParticipants.length > 0
                                    ? `${acceptedParticipants.length} participant${acceptedParticipants.length > 1 ? "s" : ""} accepté${acceptedParticipants.length > 1 ? "s" : ""}`
                                    : "Aucun participant accepté"
                                }
                            </p>
                        </div>
                    </div>

                    {/* Cooldown warning */}
                    {!canSend && (
                        <div className="bg-danger/20 border border-danger/40 rounded-xl p-3.5 flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                            <p className="text-sm text-danger">
                                Anti-spam : prochaine relance possible dans <strong>{cooldownHoursLeft}h</strong>.
                            </p>
                        </div>
                    )}

                    {/* Message input */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-caption text-muted-foreground uppercase tracking-widest font-bold">
                                Message libre
                            </label>
                            <span className={`text-caption font-bold tabular-nums ${remaining < 50 ? "text-danger" : "text-muted-foreground"}`}>
                                {remaining}/{MAX_CHARS}
                            </span>
                        </div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                            placeholder="Ex: On se retrouve à 20h sur le serveur, préparez votre stuff farm !"
                            rows={4}
                            className="w-full bg-surface/60 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-warning/40 resize-none transition-all"
                            disabled={isPending || !canSend}
                        />
                        <p className="text-caption text-muted-foreground">
                            Ce message sera envoyé en embed Discord avec vos infos de leader.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            className="flex-1 border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface font-bold h-11"
                            onClick={handleClose}
                            disabled={isPending}
                        >
                            Annuler
                        </Button>
                        <Button
                            className="flex-1 bg-warning hover:bg-warning text-warning-foreground font-black h-11 shadow-lg shadow-amber-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
