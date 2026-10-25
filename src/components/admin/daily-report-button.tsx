"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sendDailySummaryReport } from "@/server/actions/daily-report-actions";

/**
 * Déclencheur manuel du rapport quotidien (le rapport est **aussi** envoyé
 * automatiquement par le cron `/api/cron/daily-summary` et le worker Metamob) :
 * bouton discret, à la taille des autres actions de l'écran.
 */
export function DailyReportButton({ guildId }: { guildId: string }) {
    const [isPending, startTransition] = useTransition();
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSendReport = () => {
        startTransition(async () => {
            const res = await sendDailySummaryReport(guildId, true);
            if (res.success && !("skipped" in res && res.skipped)) {
                toast.success("Rapport quotidien envoyé");
                setIsSuccess(true);
                setTimeout(() => setIsSuccess(false), 3000);
            } else if (res.success && "skipped" in res && res.skipped) {
                // « Rien envoyé » n'est pas un échec : on le dit au lieu d'un faux succès.
                toast.info(
                    res.reason === "already_sent"
                        ? "Rapport déjà envoyé aujourd'hui (envoi automatique) — rien de plus à envoyer."
                        : "Rien à signaler : aucun mouvement de membre, absence, ticket ou preuve sur les dernières 24 h. Aucun message n'a été envoyé."
                );
            } else {
                toast.error(res.error || "Échec de l'envoi");
            }
        });
    };

    return (
        <Button
            onClick={handleSendReport}
            disabled={isPending}
            variant="outline"
            className="h-9 gap-2 border-border bg-surface text-xs hover:border-accent-soft-border"
        >
            {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isSuccess ? (
                <Check className="h-3.5 w-3.5 text-accent" />
            ) : (
                <Send className="h-3.5 w-3.5" />
            )}
            {isPending ? "Envoi…" : isSuccess ? "Rapport envoyé" : "Envoyer le rapport du jour"}
        </Button>
    );
}
