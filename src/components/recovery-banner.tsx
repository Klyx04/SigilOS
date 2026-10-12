import { getRecoveryBannerState } from "@/server/actions/guild-owner-actions";
import { RecoveryBannerClient } from "./recovery-banner-client";

/**
 * P2 — Spot serveur de la bannière de récupération : ne rend rien sauf
 * drapeau orphelin ouvert ou demande en cours sur cette guilde.
 */
export async function RecoveryBannerSpot({ guildId }: { guildId: string }) {
    const state = await getRecoveryBannerState(guildId).catch(() => null);
    if (!state || (!state.flagged && !state.pendingExists)) return null;
    return (
        <RecoveryBannerClient
            guildId={guildId}
            pendingExists={state.pendingExists}
            pendingByMe={state.pendingByMe}
            canClaim={state.canClaim}
        />
    );
}
