/**
 * V2 Phase 0 — Pose les variables de teinte sur le wrapper du dashboard.
 *
 * À poser sur le root `.dashboard-layout` (dashboard/[guildId]/layout.tsx) :
 * une teinte → --accent / --ring / --success se recalculent tout seuls
 * (les tokens GROK lisent --guild-hue / --guild-chroma-* / --success-hue).
 * Aucun div supplémentaire : on remplace le div existant par ce wrapper.
 *
 * ⚠️ Depuis le 14/10/2026, la **teinte n'est plus choisie par la guilde** (onglet
 * « Apparence » retiré avec son code) : `hue` reste optionnel pour un éventuel
 * usage God, mais l'appelant normal ne le passe pas → teinte par défaut.
 */

import { getGuildAccentCssVars } from "@/lib/guild-accent";

type GuildAccentStyleProps = {
    /** Teinte 0-360° — **non utilisée par le dashboard** (défaut du design system si absente). */
    hue?: number | null;
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
