/**
 * Libellés de zone de la carte du monde — emprise + ancre « réelles », et liste des libellés
 * retirés depuis God (God → Données de jeu → Éditeurs → Zones).
 *
 * 🐛 Mesures qui fondent la règle (11/10/2026, demande user : « parmi les zones que t'as ajouté
 * ya des fails ») : le libellé était posé au centre de la boîte englobante de l'**union** des
 * polygones. Sur le monde 1 (193 sous-zones à tracé) : **80 %** des libellés tombaient dans leur
 * propre tracé ainsi, **91 %** avec le centroïde du **plus grand polygone** — la règle de
 * position déjà posée pour les cibles (avis, archimonstres) par `resolveSubAreaCenter`. Cas
 * visibles de la capture : Éphedrya (3 polygones) 15 / −43.5 (en pleine mer) → 27.8 / −85.5
 * (son îlot), Mer Kantil hors tracé → dedans, Rives iridescentes −29.5 / −5.5 (au nord
 * d'Astrub !) → −27 / −54 (ses plages).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveZoneLabelFrame, zoneNameKey } from "@/lib/zone-label";
import { isPlaceholderZoneShape, parseZoneShape } from "@/lib/zone-minimap";
import { isHiddenMapZone } from "@/lib/game-data-ignores";

const RAW_WORLDMAP = JSON.parse(readFileSync("public/game-data/worldmap.json", "utf8")) as {
    subareas: Array<{ id: number; name: string | { fr?: string }; level?: number; shape?: number[] }>;
};

const read = (rel: string) => readFileSync(rel, "utf8");
const shapeById = (id: number) => RAW_WORLDMAP.subareas.find((s) => s.id === id)?.shape;
const nameById = (id: number) => {
    const name = RAW_WORLDMAP.subareas.find((s) => s.id === id)?.name;
    return typeof name === "string" ? name : name?.fr;
};

/** Point dans un tracé — test-local (aucun autre besoin dans `src/`). */
function insideOutline(shape: unknown, point: { x: number; y: number }): boolean {
    const frame = parseZoneShape(shape);
    if (!frame) return false;
    let inside = false;
    for (const polygon of frame.polygons) {
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const { x: xi, y: yi } = polygon[i];
            const { x: xj, y: yj } = polygon[j];
            if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
    }
    return inside;
}

describe("libellé de zone — emprise et ancre", () => {
    it("un seul polygone : emprise et ancre = ce polygone", () => {
        // Anneau de 4 sommets : le centroïde vaut son centre (un sommet de fermeture répété
        // pèserait dans la moyenne, comme dans les tracés réels).
        const frame = resolveZoneLabelFrame([0, 0, 10, 0, 10, 10, 0, 10]);
        expect(frame).not.toBeNull();
        expect(frame!.bounds).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 10 });
        expect(frame!.anchor).toEqual({ x: 5, y: 5 });
    });

    it("plusieurs polygones (archipel) : le plus grand décide, jamais l'union", () => {
        // Ile de 4 sommets (0,0)-(2,2), en-tête sentinelle, puis île de 5 sommets
        // (100,100)-(140,120) — le plus fourni gagne (même règle que `focus`).
        const frame = resolveZoneLabelFrame([
            0, 0, 2, 0, 2, 2, 0, 2,
            -3000, -3000,
            100, 100, 140, 100, 140, 120, 120, 120, 100, 120,
        ]);
        expect(frame!.bounds).toEqual({ minX: 100, maxX: 140, minY: 100, maxY: 120 });
        expect(frame!.anchor).toEqual({ x: 120, y: 112 });
        // Contre-épreuve : le centre de l'union (70, 60) est dans la mer — c'est exactement le
        // point que le renderer posait avant le 11/10/2026.
        expect(frame!.anchor).not.toEqual({ x: 70, y: 60 });
    });

    it("carré 1×1 hors origine : le libellé reste (il marque la case réelle de la zone)", () => {
        const frame = resolveZoneLabelFrame([10, 20, 11, 20, 11, 21, 10, 21]);
        expect(frame).not.toBeNull();
        expect(frame!.bounds).toEqual({ minX: 10, maxX: 11, minY: 20, maxY: 21 });
        expect(frame!.anchor).toEqual({ x: 10.5, y: 20.5 });
    });

    it("carré replié à l'origine du monde : aucun libellé (ce lieu n'existe pas)", () => {
        expect(resolveZoneLabelFrame([0, 0, 1, 0, 1, 1, 0, 1])).toBeNull();
        // Réel : `Destin du Monde` (toutes ses maps en (0,0)) — mesuré : 1 seule sous-zone du
        // monde 1 dans ce cas.
        const placeholder = RAW_WORLDMAP.subareas.find((s) => nameById(s.id) === "Destin du Monde")!;
        expect(isPlaceholderZoneShape(parseZoneShape(placeholder.shape))).toBe(true);
        expect(resolveZoneLabelFrame(placeholder.shape)).toBeNull();
    });

    it("sans tracé exploitable : aucun libellé", () => {
        expect(resolveZoneLabelFrame(undefined)).toBeNull();
        expect(resolveZoneLabelFrame(null)).toBeNull();
        expect(resolveZoneLabelFrame([])).toBeNull();
        expect(resolveZoneLabelFrame([0, 0, 1, 0])).toBeNull();
        // 95 des 289 sous-zones du monde 1 ont leurs maps à l'intérieur d'un bâtiment.
        expect(resolveZoneLabelFrame(shapeById(325))).toBeNull(); // « Antre de Crocabulia »
    });
});

describe("libellé de zone — fichier réel", () => {
    it("l'ancre est toujours DANS l'emprise retenue", () => {
        let framed = 0;
        for (const subArea of RAW_WORLDMAP.subareas) {
            const frame = resolveZoneLabelFrame(subArea.shape);
            if (!frame) continue;
            framed++;
            expect(frame.anchor.x).toBeGreaterThanOrEqual(frame.bounds.minX);
            expect(frame.anchor.x).toBeLessThanOrEqual(frame.bounds.maxX);
            expect(frame.anchor.y).toBeGreaterThanOrEqual(frame.bounds.minY);
            expect(frame.anchor.y).toBeLessThanOrEqual(frame.bounds.maxY);
        }
        expect(framed).toBeGreaterThan(300);
    });

    it("Éphedrya : l'ancre tombe dans son îlot, le centre de l'union en mer", () => {
        const shape = shapeById(1029);
        const frame = resolveZoneLabelFrame(shape);
        const union = parseZoneShape(shape);
        expect(frame).not.toBeNull();
        expect(insideOutline(shape, frame!.anchor)).toBe(true);
        const unionCentre = {
            x: (union!.bounds.minX + union!.bounds.maxX) / 2,
            y: (union!.bounds.minY + union!.bounds.maxY) / 2,
        };
        expect(insideOutline(shape, unionCentre)).toBe(false);
    });
});

describe("libellés masqués — God → Données de jeu → Éditeurs → Zones", () => {
    it("la clé neutralise casse, accents et ponctuation", () => {
        expect(zoneNameKey("Orée de la forêt des Abraknydes")).toBe("oreedelaforetdesabraknydes");
        expect(zoneNameKey("  ORÉE-DE  LA forêt des Abraknydes ")).toBe("oreedelaforetdesabraknydes");
        expect(zoneNameKey("Village de Pandala")).not.toBe(zoneNameKey("Tainéla"));
        expect(zoneNameKey(null)).toBe("");
    });

    it("une liste fournie est respectée (aucune lecture disque)", () => {
        const hidden = ["Ephedrya", "Rives iridescentes"];
        expect(isHiddenMapZone("ephedrya", hidden)).toBe(true);
        expect(isHiddenMapZone("ÉPHÉDRYA", hidden)).toBe(true);
        expect(isHiddenMapZone("Rives iridescentes ", hidden)).toBe(true);
        expect(isHiddenMapZone("Tainéla", hidden)).toBe(false);
        expect(isHiddenMapZone(null, hidden)).toBe(false);
        expect(isHiddenMapZone("", hidden)).toBe(false);
    });

    it("le fichier servi à la carte existe et est bien formé", () => {
        // Volontairement pas de `toEqual([])` : un God peut avoir masqué des libellés sur ce poste.
        const raw = JSON.parse(read("public/game-data/hidden-map-zones.json"));
        expect(Array.isArray(raw.names)).toBe(true);
    });

    it("le canvas lit la liste et ancre sur le plus grand polygone", () => {
        const canvas = read("src/components/worldmap/leaflet-map-core.tsx");
        expect(canvas).toContain("resolveZoneLabelFrame(subArea?.shape)");
        expect(canvas).toContain("hidden.has(zoneNameKey(name))");
        expect(canvas).toContain("const anchor = toCP(zone.anchorX, zone.anchorY);");
        // Le centre de la boîte englobante (cause du décalage mesuré) ne doit pas revenir.
        expect(canvas).not.toContain("const cx = (tl.x + br.x) / 2;");
    });

    it("la carte charge le fichier et le transmet au canvas", () => {
        expect(read("src/components/worldmap/map-viewer.tsx")).toContain("/game-data/hidden-map-zones.json");
        expect(read("src/components/worldmap/interactive-map-v2.tsx")).toContain(
            "hiddenZoneLabels={worldMap?.hiddenZoneLabels ?? []}"
        );
    });

    it("le God peut lire/écrire la liste, et les deux déploiements la préservent", () => {
        const actions = read("src/server/actions/game-data-actions.ts");
        for (const name of [
            "getHiddenMapZonesAction",
            "hideMapZoneLabelAction",
            "restoreHiddenMapZoneAction",
            "clearHiddenMapZonesAction",
        ]) {
            expect(actions).toContain(`export async function ${name}`);
        }
        expect(read("src/components/admin/ZoneManager.tsx")).toContain("hideMapZoneLabelAction");
        expect(read("scripts/deploy-cd.sh")).toContain("public/game-data/hidden-map-zones.json");
        expect(read("scripts/deploy.sh")).toContain("public/game-data/hidden-map-zones.json");
    });
});