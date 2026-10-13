"use client";

/**
 * Sondages — **réglages du vote**, partagés par les deux modales de création
 * (sondage classique et sondage programmé) : votes multiples, anonymat
 * (facultatif), expiration avec ses durées proposées, et lien externe.
 *
 * Pourquoi un composant unique : les deux modales posaient la même question de
 * deux façons — quatre durées d'un clic côté module membre, un nombre d'heures
 * en texte libre côté module staff. Deux rendus, deux jeux de bornes, deux
 * resynchronisations le jour où une durée proposée change ; ici une seule source
 * (`DURATION_PRESETS`, bornée par `MIN_DURATION_HOURS`/`MAX_DURATION_HOURS`).
 *
 * L'**anonymat** est facultatif : une modale qui ne le propose pas ne le rend
 * pas (le module membre ne l'expose pas aujourd'hui — l'état existe côté serveur,
 * ce composant ne l'invente pas).
 */

import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Info, Lock, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { durationChoices } from "@/lib/polls/scheduling";
import { cn } from "@/lib/utils";

/** Note unique « expiration coupée » : les deux modales disent la même chose. */
export const POLL_NO_EXPIRY_NOTE =
    "Sans date : le sondage sera fermé automatiquement après 30 jours.";

interface PollVoteSettingsProps {
    allowMultipleVotes: boolean;
    onAllowMultipleVotesChange: (value: boolean) => void;
    /** Anonymat — absent : cette modale ne propose pas le réglage. */
    isAnonymous?: boolean;
    onIsAnonymousChange?: (value: boolean) => void;
    hasExpiry: boolean;
    onHasExpiryChange: (value: boolean) => void;
    /** Durée du vote (heures) : la valeur courante est toujours affichée, même hors presets. */
    expiryHours: number;
    onExpiryHoursChange: (hours: number) => void;
    externalUrl: string;
    onExternalUrlChange: (value: string) => void;
    className?: string;
}

export function PollVoteSettings({
    allowMultipleVotes,
    onAllowMultipleVotesChange,
    isAnonymous,
    onIsAnonymousChange,
    hasExpiry,
    onHasExpiryChange,
    expiryHours,
    onExpiryHoursChange,
    externalUrl,
    onExternalUrlChange,
    className,
}: PollVoteSettingsProps) {
    // Une pastille « durée active » par instance : deux modales montées en même
    // temps ne se volent pas l'animation (un `layoutId` figé ferait voler le
    // surlignage d'un écran à l'autre).
    const activePillId = useId();
    const choices = durationChoices(expiryHours);

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-info/10 shrink-0">
                            <Users className="w-4 h-4 text-info" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-caption font-bold text-foreground uppercase tracking-tight">Votes multiples</p>
                            <p className="text-caption text-muted-foreground font-medium tracking-tight">Plusieurs choix possibles</p>
                        </div>
                    </div>
                    <Switch
                        checked={allowMultipleVotes}
                        onCheckedChange={onAllowMultipleVotesChange}
                        aria-label="Autoriser les votes multiples"
                        className="scale-90 shrink-0"
                    />
                </div>

                {typeof isAnonymous === "boolean" && onIsAnonymousChange && (
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2.5 rounded-xl bg-elevated shrink-0">
                                <Lock className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-caption font-bold text-foreground uppercase tracking-tight">Votes anonymes</p>
                                <p className="text-caption text-muted-foreground font-medium tracking-tight">Votants masqués</p>
                            </div>
                        </div>
                        <Switch
                            checked={isAnonymous}
                            onCheckedChange={onIsAnonymousChange}
                            aria-label="Masquer l'identité des votants"
                            className="scale-90 shrink-0"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-warning/10 shrink-0">
                            <Clock className="w-4 h-4 text-warning" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-caption font-bold text-foreground uppercase tracking-tight">Expiration</p>
                            <p className="text-caption text-muted-foreground font-medium tracking-tight">Fin automatique</p>
                        </div>
                    </div>
                    <Switch
                        checked={hasExpiry}
                        onCheckedChange={onHasExpiryChange}
                        aria-label="Fermer le vote automatiquement"
                        className="scale-90 shrink-0"
                    />
                </div>

                <AnimatePresence mode="wait">
                    {hasExpiry && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="grid grid-cols-4 gap-2 p-1 rounded-xl bg-surface/80 border border-border mt-3">
                                {choices.map((option) => (
                                    <button
                                        key={option.hours}
                                        type="button"
                                        onClick={() => onExpiryHoursChange(option.hours)}
                                        aria-pressed={expiryHours === option.hours}
                                        className={cn(
                                            "relative py-3 rounded-lg text-caption font-bold uppercase tracking-widest transition-colors",
                                            expiryHours === option.hours
                                                ? "text-info"
                                                : "text-muted-foreground hover:bg-surface"
                                        )}
                                    >
                                        {expiryHours === option.hours && (
                                            <motion.div
                                                layoutId={activePillId}
                                                className="absolute inset-0 bg-info/10 border border-info/20 rounded-lg"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                        <span className="relative z-10 flex flex-col items-center gap-1">
                                            <span className="text-sm opacity-80">{option.emoji}</span>
                                            <span>{option.label}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                {!hasExpiry && (
                    <p className="text-caption text-muted-foreground mt-2">{POLL_NO_EXPIRY_NOTE}</p>
                )}
            </div>

            <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-info/10 shrink-0">
                        <Info className="w-4 h-4 text-info" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-caption font-bold text-foreground uppercase tracking-tight">Lien externe (Optionnel)</p>
                        <p className="text-caption text-muted-foreground font-medium tracking-tight">URL associée au sondage</p>
                    </div>
                </div>
                <Input
                    type="url"
                    placeholder="https://..."
                    value={externalUrl}
                    onChange={(event) => onExternalUrlChange(event.target.value)}
                    aria-label="Lien externe associé au sondage"
                    className="bg-background/40 border-border focus:border-info/30 text-foreground rounded-xl text-xs h-10 focus:outline-none"
                />
            </div>
        </div>
    );
}
