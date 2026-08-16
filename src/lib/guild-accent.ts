/**
 * Couleur de guilde — teinte seule, luminosité/chroma imposées.
 * Design system §5 + WCAG 2.2 1.4.3 / 1.4.11 (contrastes mesurés, non arrondis).
 *
 * V2 Phase 0 (GROK) : la guilde ne choisit qu'une teinte 0-360° ; le système
 * impose luminosité + chroma → contraste garanti dans les deux thèmes.
 * (getGuildAccentStyle — type React orphelin — volontairement ignoré.)
 */

export const DEFAULT_GUILD_HUE = 155;

export const GUILD_HUE_PRESETS = [
    { id: "emeraude", label: "Émeraude", hue: 155 },
    { id: "saphir", label: "Saphir", hue: 250 },
    { id: "rubis", label: "Rubis", hue: 15 },
    { id: "amethyste", label: "Améthyste", hue: 300 },
    { id: "ambre", label: "Ambre", hue: 75 },
    { id: "cyan", label: "Cyan", hue: 210 },
] as const;

const YELLOW_HUE_MIN = 90;
const YELLOW_HUE_MAX = 110;
const GREEN_CONFLICT_MIN = 140;
const GREEN_CONFLICT_MAX = 170;

export function sanitizeGuildHue(hue: unknown): number {
    if (typeof hue !== "number" || !Number.isFinite(hue)) {
        return DEFAULT_GUILD_HUE;
    }
    const rounded = Math.round(hue);
    if (rounded < 0 || rounded > 360) {
        return DEFAULT_GUILD_HUE;
    }
    return rounded;
}

export function guildAccentChroma(hue: number): number {
    return hue >= YELLOW_HUE_MIN && hue <= YELLOW_HUE_MAX ? 0.13 : 0.15;
}

export function guildAccentChromaLight(hue: number): number {
    return hue >= YELLOW_HUE_MIN && hue <= YELLOW_HUE_MAX ? 0.13 : 0.17;
}

export function successHueForGuild(accentHue: number): number {
    if (accentHue >= GREEN_CONFLICT_MIN && accentHue <= GREEN_CONFLICT_MAX) {
        return 195;
    }
    return 150;
}

export type GuildAccentTokens = {
    hue: number;
    chromaDark: number;
    chromaLight: number;
    successHue: number;
};

export function resolveGuildAccent(hue: unknown): GuildAccentTokens {
    const safeHue = sanitizeGuildHue(hue);
    return {
        hue: safeHue,
        chromaDark: guildAccentChroma(safeHue),
        chromaLight: guildAccentChromaLight(safeHue),
        successHue: successHueForGuild(safeHue),
    };
}

export function getGuildAccentCssVars(hue: unknown): Record<string, string> {
    const tokens = resolveGuildAccent(hue);
    return {
        "--guild-hue": String(tokens.hue),
        "--guild-chroma-dark": String(tokens.chromaDark),
        "--guild-chroma-light": String(tokens.chromaLight),
        "--success-hue": String(tokens.successHue),
    };
}
