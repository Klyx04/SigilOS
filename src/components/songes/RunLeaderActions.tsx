"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Bell, Calendar as CalendarIcon, Clock, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { triggerRunNotification } from "@/server/actions/songes/dream-run-actions";
import { toast } from "sonner";

interface RunLeaderActionsProps {
    guildId: string;
    runId: string;
    isDiscordConfigured?: boolean;
    variant?: "full" | "minimal";
}

export function RunLeaderActions({ guildId, runId, isDiscordConfigured = false, variant = "full" }: RunLeaderActionsProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("On se prépare pour la run !");
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [time, setTime] = useState("21:00");

    const handleSendReminder = async () => {
        if (!message) {
            toast.error("Veuillez saisir un message");
            return;
        }

        setLoading(true);
        try {
            let scheduledDate: Date | undefined = undefined;

            if (date) {
                scheduledDate = new Date(date);
                const [hours, minutes] = time.split(":").map(Number);
                scheduledDate.setHours(hours, minutes, 0, 0);
            }

            const result = await triggerRunNotification(guildId, runId, message, scheduledDate);

            if (result.success) {
                toast.success("Rappel envoyé avec succès !");
                setIsModalOpen(false);
            } else {
                toast.error(result.error || "Une erreur est survenue");
            }
        } catch (error) {
            toast.error("Erreur lors de l'envoi du rappel");
        } finally {
            setLoading(false);
        }
    };

    if (variant === "minimal") {
        return (
            <>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsModalOpen(true);
                    }}
                    className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                    title="Envoyer un rappel aux membres"
                >
                    <Bell className="h-4 w-4" />
                </Button>

                {renderModal()}
            </>
        );
    }

    // Only hide if Discord is NOT configured AND we are in full variant (to avoid empty space)? 
    // Actually, following "Zero Config, Zero Button" policy, but we might want to keep internal notices.
    // DECISION: Show button but add alert inside modal + disclaimer in text.
    // if (!isDiscordConfigured) return null;

    return (
        <>
            <GlassPanel className="p-4 border-purple-500/20 bg-purple-500/10 dark:bg-purple-500/5">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold mb-1">
                        <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Gestion Leader</span>
                    </div>

                    <p className="text-xs text-muted-foreground mb-1">
                        {isDiscordConfigured 
                            ? "Envoyez un ping Discord et une notification dashboard à tous les membres de l'équipe."
                            : "Envoyez une notification dashboard à tous les membres de l'équipe."}
                    </p>

                    <Button
                        onClick={() => setIsModalOpen(true)}
                        variant="outline"
                        className="w-full border-purple-500/30 hover:bg-purple-500/10 text-purple-700 dark:text-purple-200 font-bold gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Envoyer un rappel
                    </Button>
                </div>
            </GlassPanel>

            {renderModal()}
        </>
    );

    function renderModal() {
        return (
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground" onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-purple-400">
                            <Bell className="w-5 h-5" />
                            Planifier un rappel
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs">
                            {isDiscordConfigured 
                                ? "Ceci enverra un ping Discord à tous les membres et une notification interne SigilOS."
                                : "Ceci enverra une notification interne SigilOS aux membres."}
                        </DialogDescription>
                    </DialogHeader>

                    {!isDiscordConfigured && (
                        <div className="mx-0 mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5">
                            <Bell className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-caption text-amber-200/80 leading-relaxed font-medium">
                                <span className="text-amber-500 font-bold block mb-0.5">Configuration Discord absente</span>
                                Le salon de notification des Songes n&apos;est pas configuré. Seule la notification interne SigilOS sera envoyée.
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-purple-300/80 uppercase tracking-wider">Message</label>
                            <Textarea
                                placeholder="Ex: On commence dans 15 minutes, tout le monde en jeu !"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="bg-surface border-border focus:border-purple-500/50 min-h-[80px] text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-purple-300/80 uppercase tracking-wider">Date</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal bg-surface border-border text-xs",
                                                !date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                            {date ? format(date, "PPP", { locale: fr }) : <span>Choisir</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-black border-border z-[200]">
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={setDate}
                                            initialFocus
                                            className="bg-background text-foreground"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-purple-300/80 uppercase tracking-wider">Heure</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        type="time"
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        className="bg-surface border-border pl-9 text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setIsModalOpen(false)}
                            className="text-foreground/60 hover:text-foreground"
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSendReminder}
                            disabled={loading}
                            className="bg-purple-600 hover:bg-purple-500 text-foreground min-w-[120px]"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Envoyer le ping"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }
}
