"use client";

/**
 * Encart « Prime » d'un avis de recherche — **fiche interne** (module Succès › Fiches Avis) et
 * **fiche publique** (`/boss/<slug>`) : une seule définition, deux emplacements (jamais deux
 * markup qui divergent).
 * Icône **locale** (`bountyRewardIcon` : `public/assets/avis/` ou proxy d'assets interne, jamais de
 * CDN) + montant + monnaie. Sans récompense : rien (jamais un encart vide).
 */

import { bountyRewardIcon, type BountyRewardLine } from "@/lib/bounty-fiche";

export function BountyRewardCard({ rewards }: { rewards: BountyRewardLine[] }) {
    const lines = (Array.isArray(rewards) ? rewards : []).filter(
        (reward) => reward && (String(reward.type ?? "").trim() || reward.amount > 0)
    );
    if (lines.length === 0) return null;

    return (
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Prime</span>
            {lines.map((reward, index) => {
                const icon = bountyRewardIcon(reward.type);
                return (
                    <span key={`${reward.type}-${index}`} className="inline-flex items-center gap-1.5">
                        {icon ? (
                            // eslint-disable-next-line @next/next/no-img-element -- asset LOCAL (`/assets/avis/` ou proxy interne) : aucun hotlink, donc pas de `next/image` distant à configurer
                            <img src={icon} alt="" className="h-5 w-5 shrink-0 object-contain" />
                        ) : null}
                        <strong className="font-mono text-xs font-semibold tabular-nums text-foreground">
                            {reward.amount > 0 ? `${reward.amount.toLocaleString("fr-FR")} ` : ""}
                            {reward.type}
                        </strong>
                    </span>
                );
            })}
        </span>
    );
}
