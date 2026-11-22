/**
 * Paliers de l'overlay Rush — règle pure, partagée par le ResizeObserver et l'en-tête.
 *
 * Mesure du 22/11/2026 : l'ancienne expression `h >= 900 ? "wide" : w < 580 ...` classait
 * une PiP de 400 × 1000 en `wide` (la hauteur gagnait avant la largeur), alors que la
 * même fenêtre était `small`. Les commentaires disaient 820 px, le code utilisait 900.
 *
 * Règle : `tight` dès qu'un côté est étroit (PiP), sinon `wide` à partir de 820 px de
 * haut, sinon `normal`. Aucun import serveur : utilisable côté client.
 */

export type OverlayDensity = "wide" | "normal" | "tight";

export const OVERLAY_NARROW_WIDTH = 580;
export const OVERLAY_NARROW_HEIGHT = 640;
export const OVERLAY_WIDE_HEIGHT = 820;

export function resolveOverlayLayout(
    width: number,
    height: number,
): { small: boolean; density: OverlayDensity } {
    const small = width < OVERLAY_NARROW_WIDTH || height < OVERLAY_NARROW_HEIGHT;
    const density: OverlayDensity = small ? "tight" : height >= OVERLAY_WIDE_HEIGHT ? "wide" : "normal";
    return { small, density };
}
