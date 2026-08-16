/**
 * V2 Phase 0 — Pose les variables de teinte de guilde sur le wrapper du dashboard.
 *
 * À poser sur le root `.dashboard-layout` (dashboard/[guildId]/layout.tsx) :
 * une teinte → --accent / --ring / --success se recalculent tout seuls
 * (les tokens GROK lisent --guild-hue / --guild-chroma-* / --success-hue).
 * Aucun div supplémentaire : on remplace le div existant par ce wrapper.
 */

import { getGuildAccentCssVars } from "@/lib/guild-accent";

type GuildAccentStyleProps = {
    hue: number | null | undefined;
    className?: string;
    children: React.ReactNode;
};

export function GuildAccentStyle({
    hue,
    className,
    children,
}: GuildAccentStyleProps) {
    return (
        <div
            className={className}
            style={getGuildAccentCssVars(hue) as React.CSSProperties}
        >
            {children}
        </div>
    );
}
