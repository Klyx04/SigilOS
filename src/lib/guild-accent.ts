/**
 * Teinte du dashboard — luminosité/chroma imposées (contrastes mesurés, non arrondis).
 * Design system §5 + WCAG 2.2 1.4.3 / 1.4.11.
 *
 * ⚠️ Depuis le 14/10/2026, la guilde **ne choisit plus** sa teinte : l'onglet
 * « Apparence » a été retiré avec son code (`GuildConfig.accentHue` reste en base,
 * inutilisée — colonne conservée, aucune donnée supprimée). Cette lib ne sert donc
 * plus qu'à poser la **teinte par défaut** du design system.
 */

export const DEFAULT_GUILD_HUE = 155;

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
