"use client";
// Songes — surfaces et actions sur les TOKENS du thème (accent unique : info) ; contrat : src/lib/songes/ui.ts

import { useState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Bell, Calendar as CalendarIcon, Clock, Send, Loader2, Pause, Play, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { triggerRunNotification, setDreamRunStandBy, transferRunLead } from "@/server/actions/songes/dream-run-actions";
import { toast } from "sonner";
import { isStandByActive } from "@/lib/group-standby";

/**
 * **Reprise de lead** d'une run (lot B, 30/10/2026) — un membre de l'équipe reprend la run
 * quand le leader s'en va. Le serveur arbitre (`transferRunLead` → leader ou admin).
 *
 * Partagé par le panneau leader et la vue administrateur : une seule implémentation.
 */
export function RunLeadTransfer({
    guildId,
    runId,
    candidates,
    onDone,
}: {
    guildId: string;
    runId: string;
    candidates: { userId: string; name: string }[];
    onDone?: () => void;
}) {
    const [target, setTarget] = useState("");
    const [loading, setLoading] = useState(false);

    if (candidates.length === 0) return null;

    const handleTransfer = async () => {
        if (!target) {
            toast.error("Choisis le nouveau leader.");
            return;
        }
        setLoading(true);
        try {
            const res = await transferRunLead(guildId, runId, target);
            if (res.success) {
                toast.success("Lead transféré.");
                setTarget("");
                onDone?.();
            } else {
                toast.error(res.error || "Transfert impossible.");
            }
        } catch {
            toast.error("Erreur lors du transfert de lead");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row gap-2">
            <select
                aria-label="Nouveau leader de la run"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                disabled={loading}
                className="h-10 flex-1 min-w-0 rounded-lg bg-surface border border-border px-3 text-xs text-foreground"
            >
                <option value="">Choisir un nouveau leader…</option>
                {candidates.map((candidate) => (
                    <option key={candidate.userId} value={candidate.userId}>
                        {candidate.name}
                    </option>
                ))}
            </select>
            <Button
                onClick={handleTransfer}
                disabled={loading || !target}
                variant="outline"
                className="gap-2 shrink-0 border-border text-foreground/80 hover:text-foreground"
            >
                <Crown className="w-4 h-4" /> Transférer
            </Button>
        </div>
    );
}

/**
 * Bouton **« Stand-by »** d'une run Songes (30/10/2026) — partagé par le panneau leader
 * (`RunLeaderActions`) et la vue **administrateur** de `RunCard` : une seule implémentation,
 * donc un seul comportement (et un seul endroit à corriger).
 *
 * Le serveur reste l'arbitre (`setDreamRunStandBy` → `canToggleStandBy`) : ce composant ne
 * fait que proposer le geste.
 */
export function RunStandByButton({
    guildId,
    runId,
    standBy,
    onToggled,
    className,
}: {
    guildId: string;
    runId: string;
    /** Valeur brute de `DreamRun.standBy` (`null` = active). */
    standBy: unknown;
    onToggled?: () => void;
    className?: string;
}) {
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        const paused = !isStandByActive(standBy);
        setLoading(true);
        try {
            const res = await setDreamRunStandBy(guildId, runId, paused);
            if (res.success) {
                toast.success(paused
                    ? "Run en stand-by — rappels et relances suspendus."
                    : "Stand-by levé — rappels et relances reprennent.");
                onToggled?.();
            } else {
                toast.error(res.error || "Changement impossible.");
            }
        } catch {
            toast.error("Erreur lors du changement de stand-by");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handleToggle}
            variant="outline"
            disabled={loading}
            className={cn("gap-2", className)}
            title="Suspendre les rappels et les relances sans fermer la run"
        >
            {isStandByActive(standBy)
                ? <><Play className="w-4 h-4" /> Reprendre</>
                : <><Pause className="w-4 h-4" /> Mettre en stand-by</>}
        </Button>
    );
}

interface RunLeaderActionsProps {
    guildId: string;
    runId: string;
    isDiscordConfigured?: boolean;
    variant?: "full" | "minimal";
    /** « Stand-by » (30/10/2026) : valeur brute de `DreamRun.standBy` (`null` = active). */
    standBy?: unknown;
    /** Appelé après un changement de stand-by pour rafraîchir la carte. */
    onToggled?: () => void;
    /** Membres éligibles à la reprise de lead (hors leader actuel). */
    transferCandidates?: { userId: string; name: string }[];
}

export function RunLeaderActions({
    guildId,
    runId,
    isDiscordConfigured = false,
    variant = "full",
    standBy = null,
    onToggled,
    transferCandidates,
}: RunLeaderActionsProps) {
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
                const pinged = (result as { pinged?: number }).pinged;
                const skipped = (result as { skipped?: number }).skipped;
                toast.success(
                    typeof pinged === "number" || typeof skipped === "number"
                        ? `Rappel envoyé (${pinged ?? 0} pingé(s), ${skipped ?? 0} déjà en vocal) !`
                        : "Rappel envoyé avec succès !"
                );
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

    /**
     * Stand-by (30/10/2026) : suspend le rappel H-1, les relances d'inactivité et la
     * clôture J+21. Les candidatures restent ouvertes (contrat `@/lib/group-standby`).
     * L'implémentation vit dans `RunStandByButton` (partagée avec la vue admin).
     */

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
                    className="h-8 w-8 text-info hover:text-info hover:bg-info/15"
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
            <GlassPanel className="p-4 border-info/40 bg-info/15 dark:bg-info/15">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-info dark:text-info font-semibold mb-1">
                        <Bell className="w-4 h-4 text-info dark:text-info" />
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
                        className="w-full border-info/40 hover:bg-info/15 text-info dark:text-info font-bold gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Envoyer un rappel
                    </Button>

                    {/* Stand-by (30/10/2026) : suspend le H-1, les relances d'inactivité et la
                        clôture J+21 ; les candidatures restent ouvertes. */}
                    <RunStandByButton
                        guildId={guildId}
                        runId={runId}
                        standBy={standBy}
                        onToggled={onToggled}
                        className="w-full border-border text-foreground/80 hover:text-foreground"
                    />

                    {/* Reprise de lead (lot B) : le leader part → un membre reprend la run. */}
                    {transferCandidates && transferCandidates.length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-border/60">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Reprise de lead
                            </p>
                            <RunLeadTransfer
                                guildId={guildId}
                                runId={runId}
                                candidates={transferCandidates}
                                onDone={onToggled}
                            />
                        </div>
                    )}
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
                        <DialogTitle className="flex items-center gap-2 text-info">
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
                        <div className="mx-0 mt-2 px-3 py-2 bg-warning/15 border border-warning/40 rounded-lg flex items-start gap-2.5">
                            <Bell className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <div className="text-caption text-warning leading-relaxed font-medium">
                                <span className="text-warning font-bold block mb-0.5">Configuration Discord absente</span>
                                Le salon de notification des Songes n&apos;est pas configuré. Seule la notification interne SigilOS sera envoyée.
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-info uppercase tracking-wider">Message</label>
                            <Textarea
                                placeholder="Ex: On commence dans 15 minutes, tout le monde en jeu !"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="bg-surface border-border focus:border-info/40 min-h-[80px] text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-info uppercase tracking-wider">Date</label>
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
                                    <PopoverContent className="w-auto p-0 bg-background border-border z-[200]">
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
                                <label className="text-xs font-medium text-info uppercase tracking-wider">Heure</label>
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
                            className="bg-info/15 hover:bg-info/15 text-foreground min-w-[120px]"
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
