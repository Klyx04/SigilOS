/**
 * Helpers purs de la worldmap (tuiles + snap) — sans dépendance Leaflet/React,
 * pour rester testables en unitaire (vitest).
 */

/** Teinte "océan" des tuiles : fond d'attente/chargement au lieu du noir. */
export const MAP_OCEAN_TONE = '#a9c6bb';

/**
 * Résout l'échelle + la banque de tuiles pour un zoom Leaflet donné.
 * - Arrondit le zoom (zoomSnap fractionnaire : évite `scales[2.3] === undefined`
 *   qui faisait jeter `getTileUrl` → tuiles transparentes = carrés noirs).
 * - Fail-closed : borne toujours sur une échelle connue, ne jette jamais.
 */
export function resolveTileBank(scales: number[], z: number): { scale: number; bank: string } {
    const cleanScale = (val: number) => parseFloat(val.toFixed(4)).toString();
    const safe = Array.isArray(scales) && scales.length > 0 ? scales : [1];
    const idx = -Math.round(z);
    if (idx >= 0 && idx < safe.length) {
        const scale = safe[idx];
        return { scale, bank: scale === 1 ? '1' : cleanScale(scale) };
    }
    if (idx < 0) return { scale: 1, bank: '1' };
    const last = safe[safe.length - 1];
    return { scale: last, bank: cleanScale(last) };
}

/**
 * Le couple **(0, 0)** de `worldmap.json` n'est pas un lieu : c'est le tas des
 * maps sans coordonnées connues. Mesuré sur le fichier réel — monde 1 : **1 784
 * maps sur 8 476** réparties sur **270 de ses 289 sous-zones** ; tous mondes :
 * 2 188 maps, dont **1 449 hors du tracé de leur propre zone** ; 191 donjons ont
 * leur map d'entrée ici (60, tous les « Expéditions », même map indoor) et
 * **15 sous-zones n'ont que cette position** (Songes Infinis, Ankama, Dofus
 * Games…). Lire ce couple affichait donc une zone arbitraire et une tuile HD
 * hors sujet (`hd_maps/5.webp` = une map de combat) : toute position (0, 0) est
 * traitée comme « position inconnue » (jamais indexée, jamais un centre).
 */
export function hasKnownGameCoords(
    map: { x?: number | null; y?: number | null } | null | undefined
): boolean {
    if (!map || !Number.isFinite(map.x) || !Number.isFinite(map.y)) return false;
    return !(map.x === 0 && map.y === 0);
}

/**
 * Snap vers la map valide la plus proche (périmètre, pas le carré plein).
 * `maxR` petit (=5) pour le survol à 10 Hz, large (=15) pour le clic.
 */
export function findNearestMap(
    mapsByCoords: Map<string, any> | undefined,
    gx0: number,
    gy0: number,
    maxR = 5
): { foundMap: any; gx: number; gy: number } {
    let found = mapsByCoords?.get(`${gx0},${gy0}`);
    let gx = gx0;
    let gy = gy0;
    if (!found) {
        outer: for (let r = 1; r <= maxR; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // périmètre seul
                    const m = mapsByCoords?.get(`${gx0 + dx},${gy0 + dy}`);
                    if (m) {
                        found = m;
                        gx = gx0 + dx;
                        gy = gy0 + dy;
                        break outer;
                    }
                }
            }
        }
    }
    return { foundMap: found, gx, gy };
}
