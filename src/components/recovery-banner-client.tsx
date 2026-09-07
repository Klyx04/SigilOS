"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { claimGuildRecovery } from "@/server/actions/guild-owner-actions";

/**
 * P2 — Bannière de récupération (guilde orpheline). Affichée au membre actif
 * le plus ancien (bouton de dépôt) ou état d'attente. Jamais d'auto-élévation :
 * God approuve via le transfert de propriété existant.
 */
export function RecoveryBannerClient({
    guildId,
    pendingExists,
    pendingByMe,
    canClaim,
}: {
    guildId: string;
    pendingExists: boolean;
    pendingByMe: boolean;
    canClaim: boolean;
}) {
    const [isPending, startTransition] = useTransition();
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClaim = () => {
        setError(null);
        startTransition(async () => {
            const res = await claimGuildRecovery(guildId);
            if (res.success) {
                setDone(true);
            } else {
                setError(res.error || "Échec du dépôt de la demande.");
            }
        });
    };

    return (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4">
            <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-warning font-black uppercase tracking-widest text-sm">
                    Guilde sans administrateur
                </p>
                <p className="text-warning/80 text-xs mt-1 leading-relaxed">
                    {done || pendingByMe
                        ? "Votre demande de récupération est en cours d'examen par le staff. Vous serez notifié de la décision."
                        : pendingExists
                            ? "Une demande de récupération est en cours d'examen par le staff."
                            : "Cette guilde n'a plus aucun administrateur. En tant que membre le plus ancien, vous pouvez demander sa récupération — le staff validera."}
                </p>
                {error && <p className="text-danger text-xs mt-1 font-bold">{error}</p>}
                {canClaim && !done && !pendingExists && (
                    <button
                        type="button"
                        onClick={handleClaim}
                        disabled={isPending}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-warning text-warning-foreground text-xs font-black uppercase tracking-wider hover:bg-warning transition-colors disabled:opacity-50"
                    >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Demander la récupération
                    </button>
                )}
            </div>
        </div>
    );
}
