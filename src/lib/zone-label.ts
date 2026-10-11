/**
 * Libellé de zone de la carte du monde (« Nom » + « niv. N » dessinés au canvas).
 *
 * Source de vérité de la géométrie : `subareas[].shape` de `worldmap.json` — la même
 * que le bouton « Zones » et l'encart de zone (parsée une seule fois, dans
 * `src/lib/zone-minimap.ts`).
 *
 * 🐛 Mesure du 11/10/2026 (demande user : « parmi les zones que t'as ajouté ya des
 * fails ») : le libellé était posé au centre de la **boîte englobante de l'union** de
 * tous les polygones. Sur une zone multi-polygones (îles, avis éclatés, carrés
 * sentinelles) ce centre tombe **en pleine mer** :
 * - `Éphedrya` (3 polygones, monde 1) : union 15 / −43.5 (hors tracé) contre
 *   27.8 / −85.5 (dans son îlot) ;
 * - `Rives iridescentes` (2 polygones) : union −29.5 / −5.5 (au nord d'Astrub !)
 *   contre −27.1 / −54 (ses plages) ;
 * - `Mer Kantil`, `Vulkania` : union hors tracé, centroïde dedans.
 * Mesuré sur le monde 1 (194 sous-zones à tracé) : **155/194 = 80 %** des libellés
 * tombaient dans leur propre tracé avec l'union, **176/194 = 91 %** avec le centroïde
 * du plus grand polygone — c'est la règle de position déjà appliquée aux cibles
 * (avis, archimonstres) par `resolveSubAreaCenter`.
 *
 * Deux conséquences, verrouillées par `tests/unit/zone-label.test.ts` :
 * 1. l'emprise retenue pour le test « le libellé tient dans la zone » est celle du
 *    **plus grand polygone** (une union d'archipel autoriserait un libellé sur l'océan) ;
 * 2. un tracé **replié à l'origine du monde** (carré 1×1 en (0, 0), toutes ses maps aussi en
 *    (0, 0)) n'est pas un lieu ⇒ aucun libellé : c'est la règle `isPlaceholderZoneShape` déjà
 *    éprouvée. Mesuré : **1 seule** sous-zone du monde 1 (`Destin du Monde`).
 *
 * ⚖️ Arbitrage mesuré (11/10/2026) : les **autres** carrés 1×1 ne sont pas écartés — leurs
 * maps sont bien sur cette case (`Antre du Koulosse`, `Forge du Volcan`, `Quelque part`,
 * `Anomalies temporelles`…) : les retirer supprimerait 16 libellés **justes**. Le repli
 * « centre des cases de la zone » a lui aussi été écarté par la mesure : les sous-zones
 * portent souvent des maps intérieures, le centre des maps ne tombe dans le tracé que dans
 * 12-28 % des cas (contre 91 % pour le centroïde du plus grand polygone).
 */
import { isPlaceholderZoneShape, parseZoneShape, type ZoneBounds, type ZonePoint } from "./zone-minimap";

export interface ZoneLabelFrame {
    /** Emprise du plus grand polygone (coin de case, comme les sommets du tracé). */
    bounds: ZoneBounds;
    /** Point d'ancrage du libellé : centroïde du plus grand polygone. */
    anchor: ZonePoint;
}

/**
 * Emprise + ancrage réels d'un libellé de zone, ou `null` s'il n'y a rien à nommer
 * (pas de tracé exploitable, ou tracé replié à l'origine du monde).
 */
export function resolveZoneLabelFrame(shape: unknown): ZoneLabelFrame | null {
    const frame = parseZoneShape(shape);
    if (!frame) return null;
    // Carré replié à l'origine : un lieu qui n'existe sur aucune carte du monde.
    if (isPlaceholderZoneShape(frame)) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of frame.main) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }
    if (!Number.isFinite(minX)) return null;

    return { bounds: { minX, maxX, minY, maxY }, anchor: frame.focus };
}

/**
 * Clé de comparaison d'un nom de zone : casse, accents et ponctuation neutralisés
 * (« Orée de la forêt des Abraknydes » ↔ « oree de la foret des abraknydes »).
 *
 * Le renderer du canvas est un **composant client** : il ne peut pas importer
 * `src/lib/game-data-ignores.ts` (qui lit le disque, donc serveur uniquement). Cette
 * clé est donc ici, pure, et partagée par les deux étages — même normalisation de
 * part et d'autre, sinon un « masquer » du God resterait sans effet visible.
 */
export function zoneNameKey(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}
