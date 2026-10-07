import { describe, it, expect } from "vitest";
import {
    applyClientMapFreshness,
    DOFUS_MAP_COLS,
    DOFUS_MAP_ROWS,
    getClientLayout,
    getClientMapFull,
    layoutToCells,
    withClientExtraMaps,
} from "@/lib/dungeons/client-maps-registry";
import type { DofensiveMapData, DofensiveMapLite } from "@/lib/dofensive-api";

function fakeMap(id: number, cells?: number[][]): DofensiveMapData {
    return {
        id,
        name: `Map ${id}`,
        subarea: { id: 1, name: "Zone" },
        dungeon: { id: 118, name: "Fers de la Tyrannie" },
        isBossMap: false,
        coordinates: { x: 4, y: -3 },
        cells: cells ?? [],
        allyCells: [1, 2, 3],
        enemyCells: [4, 5, 6],
    };
}

describe("client-maps-registry — corrélation simus ↔ client 3.6.11.15", () => {
    it("layoutToCells : grille 40×14 (0/1/2), row-major comme Dofensive", () => {
        const cells = layoutToCells({ blocked: [0, 559], holes: [1] });
        expect(cells).toHaveLength(DOFUS_MAP_ROWS);
        expect(cells[0]).toHaveLength(DOFUS_MAP_COLS);
        expect(cells[0][0]).toBe(2);
        expect(cells[0][1]).toBe(1);
        expect(cells[0][2]).toBe(0);
        expect(cells[39][13]).toBe(2);
    });

    it("getClientLayout : connaît les 20 layouts siphonnés (2 donjons × 5 × 2), rien d'autre", () => {
        expect(getClientLayout(203161606)?.which).toBe("alt");
        expect(getClientLayout(203161600)?.which).toBe("normal");
        expect(getClientLayout(187959554)?.which).toBe("alt");
        expect(getClientLayout(187957506)?.which).toBe("normal");
        expect(getClientLayout(999999)).toBeUndefined();
        expect(getClientLayout(203165698)).toBeUndefined();
    });

    it("applyClientMapFreshness : grille + placements client, métadonnées conservées", () => {
        const patched = applyClientMapFreshness(fakeMap(203161606));
        expect(patched.name).toBe("Map 203161606");
        expect(patched.coordinates).toEqual({ x: 4, y: -3 });
        expect(patched.subarea).toEqual({ id: 1, name: "Zone" });
        expect(patched.cells).toHaveLength(40);
        const flat = patched.cells.flat();
        expect(flat.filter((v) => v === 2)).toHaveLength(20);
        expect(flat.filter((v) => v === 1)).toHaveLength(222);
        // Convention Dofus (prouvée Ankama_Fight.d2ui) : allyCells = monstres/défenseurs (bleu), enemyCells = joueurs/attaquants (rouge).
        expect(patched.allyCells).toEqual([231, 246, 247, 259, 274, 275, 317, 318]);
        expect(patched.enemyCells).toEqual([369, 370, 382, 398, 399, 410, 411, 427, 439, 440]);
    });

    it("applyClientMapFreshness : map inconnue retournée inchangée (même référence)", () => {
        const data = fakeMap(123456);
        expect(applyClientMapFreshness(data)).toBe(data);
    });

    it("getClientMapFull : layouts Normal (inconnus de Dofensive), métadonnées minimales honnêtes", () => {
        const full = getClientMapFull(203161600);
        if (!full) throw new Error("layout normal manquant");
        expect(full.name).toBe("Fers de la Tyrannie - Première salle (Donjon)");
        expect(full.dungeon).toEqual({ id: 118, name: "Fers de la Tyrannie" });
        expect(full.subarea).toBeNull();
        expect(full.coordinates).toBeNull();
        expect(full.isBossMap).toBe(false);
        expect(full.cells.flat().filter((v) => v === 2)).toHaveLength(64);
        expect(full.allyCells).toHaveLength(8);
        expect(full.enemyCells).toHaveLength(8);
        const boss = getClientMapFull(203165696);
        expect(boss?.isBossMap).toBe(true);
        const solar = getClientMapFull(187957512);
        expect(solar?.dungeon).toEqual({ id: 109, name: "Tour de Solar" });
        expect(solar?.isBossMap).toBe(true);
        expect(getClientMapFull(203161606)).toBeNull();
        expect(getClientMapFull(999999)).toBeNull();
    });

    it("withClientExtraMaps : ajoute les 5 layouts Normal, sans doublon, autres donjons intacts", () => {
        const base: DofensiveMapLite[] = [
            { id: 203161606, name: "Fers de la Tyrannie - Première salle" },
            { id: 203165702, name: "Fers de la Tyrannie - Cinquième salle", isBoss: true },
        ];
        const merged = withClientExtraMaps(118, base);
        expect(merged).toHaveLength(7);
        expect(merged.map((m) => m.id)).toEqual([
            203161606, 203165702, 203161600, 203162624, 203163648, 203164672, 203165696,
        ]);
        expect(merged.filter((m) => m.isBoss).map((m) => m.id)).toEqual([203165702, 203165696]);
        expect(merged[2].name).toBe("Fers de la Tyrannie - Première salle (Donjon)");
        // Les extras sont marqués « client » (badge distinctif dans les menus).
        expect(merged.slice(2).every((m) => m.fromClient === true)).toBe(true);
        expect(base.every((m) => m.fromClient === undefined)).toBe(true);
        // Idempotent : relancé sur le résultat, rien ne s'ajoute.
        expect(withClientExtraMaps(118, merged)).toHaveLength(7);
        // Donjon inconnu : tableau d'origine, même référence.
        expect(withClientExtraMaps(999, base)).toBe(base);
        const solar = withClientExtraMaps(109, []);
        expect(solar.map((m) => m.id)).toEqual([187957506, 187957508, 187957248, 187957510, 187957512]);
    });
});
