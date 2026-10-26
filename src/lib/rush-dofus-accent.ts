/**
 * Accents Dofus — **contraste garanti** (T-4 / O14).
 *
 * La couleur **canonique** de chaque Dofus est arbitrée dans `rush-dofus-meta.ts`
 * (identité du Dofus, jamais la moyenne de son visuel — ces icônes sont orfévrées).
 * Ce module ne change **aucune** couleur : il répond à l'autre moitié du besoin —
 * qu'un accent reste **lisible** sur le thème clair **et** sur le thème sombre.
 *
 * Ébène (`#52525b`) disparaît sur un fond sombre, Ivoire (`#e2e8f0`) sur un fond
 * clair. On garde donc la teinte et on ne déplace que la **luminosité**, par pas
 * de 5 %, jusqu'à atteindre le ratio WCAG AA du texte normal (4,5:1).
 *
 * Tout est pur (aucun DOM, aucune variable CSS) : c'est testable et utilisable
 * côté serveur comme côté client.
 */

/** Ratio WCAG AA pour du texte normal. */
export const MIN_CONTRAST = 4.5;
/** Fond de référence du thème sombre du guide (zinc-950). */
export const DARK_SURFACE = "#0b0b0b";
/** Fond de référence du thème clair du guide. */
export const LIGHT_SURFACE = "#ffffff";

/** `#rgb` / `#rrggbb` → `[r, g, b]`, ou `null` si la valeur n'est pas un hex lisible. */
export function parseHex(hex: string | null | undefined): [number, number, number] | null {
    const value = (hex ?? "").trim().replace(/^#/, "");
    const normalized =
        value.length === 3
            ? value.split("").map((c) => c + c).join("")
            : value;
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    return [
        parseInt(normalized.slice(0, 2), 16),
        parseInt(normalized.slice(2, 4), 16),
        parseInt(normalized.slice(4, 6), 16),
    ];
}

/** `[r, g, b]` → `#rrggbb`. */
export function toHex(rgb: [number, number, number]): string {
    return `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

/** Luminance relative WCAG d'une couleur. */
export function relativeLuminance(hex: string): number {
    const rgb = parseHex(hex);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG entre deux couleurs (1 → 21). */
export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const [light, dark] = la >= lb ? [la, lb] : [lb, la];
    return (light + 0.05) / (dark + 0.05);
}

/** Mélange `from` vers `to` dans l'espace sRGB (`ratio` de 0 à 1). */
export function mixHex(from: string, to: string, ratio: number): string {
    const a = parseHex(from);
    const b = parseHex(to);
    if (!a || !b) return from;
    const t = Math.max(0, Math.min(1, ratio));
    return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** Texte lisible **sur** un aplat de cette couleur (`#ffffff` ou `#000000`). */
export function bestTextOn(hex: string): string {
    return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#000000") ? "#ffffff" : "#000000";
}

export type ReadableAccent = {
    /** Couleur à peindre (l'originale si elle passe déjà). */
    color: string;
    /** Ratio obtenu sur la surface demandée. */
    ratio: number;
    /** Vrai si la couleur a dû être déplacée en luminosité. */
    adjusted: boolean;
};

/**
 * Accent lisible sur une surface donnée : garde la teinte, déplace la luminosité
 * par pas de 5 % vers le pôle opposé (blanc sur fond sombre, noir sur fond clair)
 * jusqu'à `min` (4,5:1 par défaut). Une couleur illisible (non hexadécimale) est
 * rendue telle quelle, ratio 0 — on ne devine pas une couleur.
 */
export function readableOn(
    hex: string,
    surface: string = DARK_SURFACE,
    min: number = MIN_CONTRAST
): ReadableAccent {
    if (!parseHex(hex) || !parseHex(surface)) return { color: hex, ratio: 0, adjusted: false };

    const initial = contrastRatio(hex, surface);
    if (initial >= min) return { color: hex, ratio: initial, adjusted: false };

    // Pôle opposé à la surface : on éclaircit sur fond sombre, on assombrit sur fond clair.
    const surfaceIsDark = relativeLuminance(surface) < 0.5;
    const pole = surfaceIsDark ? "#ffffff" : "#000000";

    let candidate = hex;
    let ratio = initial;
    for (let step = 1; step <= 20; step += 1) {
        candidate = mixHex(hex, pole, step * 0.05);
        ratio = contrastRatio(candidate, surface);
        if (ratio >= min) break;
    }
    return { color: candidate, ratio, adjusted: true };
}

/** Accent lisible dans les deux thèmes : la couleur du thème qui contraint le plus. */
export function readableEverywhere(hex: string, min: number = MIN_CONTRAST): ReadableAccent {
    const dark = readableOn(hex, DARK_SURFACE, min);
    const light = readableOn(hex, LIGHT_SURFACE, min);
    return dark.ratio <= light.ratio ? dark : light;
}
