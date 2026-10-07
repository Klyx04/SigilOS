import { describe, it, expect } from "vitest";
import { buildQilbyArena, getQilbyCustomMapData, getQilbyDungeonInfo, QILBY_MAP_ID, QILBY_MONSTER_ID } from "@/lib/qilby-map";
import { resolveAnomalyMap, QILBY_ANOMALY_MAP, DEFAULT_ANOMALY_MAP } from "@/lib/anomaly-boss";
import { cellIdToXY, toLos } from "@/lib/dofus-grid";

describe("Qilby Custom Arena Map", () => {
    it("génère les 5 plateformes de 5x5 cellules marchables séparées par du vide", () => {
        const arena = buildQilbyArena();

        // 5 plateformes de 25 cases = 125 cases marchables au total
        let walkableCount = 0;
        let holeCount = 0;
        for (let r = 0; r < arena.cells.length; r++) {
            for (let c = 0; c < arena.cells[r].length; c++) {
                if (arena.cells[r][c] === 0) walkableCount++;
                if (arena.cells[r][c] === 1) holeCount++;
            }
        }

        expect(walkableCount).toBe(125);
        expect(holeCount).toBe(40 * 14 - 125);

        // Qilby est au centre : 25 cases allyCells (défenseur = BLEU, convention Dofus prouvée)
        expect(arena.allyCells).toHaveLength(25);
        // Les 4 plateformes périphériques pour les joueurs/attaquants : 4 * 25 = 100 cases enemyCells (ROUGE)
        expect(arena.enemyCells).toHaveLength(100);

        // Vérifie qu'aucun overlap n'existe entre allyCells et enemyCells
        const intersection = arena.allyCells.filter((id) => arena.enemyCells.includes(id));
        expect(intersection).toHaveLength(0);

        // Vérifie que toutes les cellules de Qilby (allyCells) sont bien à distance losange <= 2 du centre (16, 4)
        // (îlot central à l'écran x=6, y=20 : u = (y + 2x) / 2, v = (y - 2x) / 2)
        for (const cellId of arena.allyCells) {
            const pos = cellIdToXY(cellId);
            const los = toLos(pos.x, pos.y);
            expect(Math.abs(los.x - 16)).toBeLessThanOrEqual(2);
            expect(Math.abs(los.y - 4)).toBeLessThanOrEqual(2);
        }
    });

    it("résout la carte spécifique de Qilby lors de la résolution de map d'anomalie", () => {
        // Sans preferredMaps, Qilby obtient sa map d'arène sur-mesure
        const res = resolveAnomalyMap([], QILBY_MONSTER_ID);
        expect(res.id).toBe(QILBY_ANOMALY_MAP.id);
        expect(res.name).toBe(QILBY_ANOMALY_MAP.name);
        expect(res.isDefault).toBe(false);

        // Un autre monstre retombe sur la map par défaut
        const otherRes = resolveAnomalyMap([], 12345);
        expect(otherRes.id).toBe(DEFAULT_ANOMALY_MAP.id);
        expect(otherRes.name).toBe(DEFAULT_ANOMALY_MAP.name);
        expect(otherRes.isDefault).toBe(true);
    });

    it("fournit l'objet DofensiveMapData complet et les infos donjon", () => {
        const mapData = getQilbyCustomMapData();
        expect(mapData.id).toBe(QILBY_MAP_ID);
        expect(mapData.name).toBe("Hauteurs de l'Inglorium");
        expect(mapData.isBossMap).toBe(true);
        expect(mapData.cells).toBeDefined();
        expect(mapData.allyCells.length).toBe(25);  // Qilby (défenseur = cases bleues)
        expect(mapData.enemyCells.length).toBe(100); // Joueurs (attaquants = cases rouges)

        const dungInfo = getQilbyDungeonInfo();
        expect(dungInfo.dungeonName).toBe("Hauteurs de l'Inglorium");
        expect(dungInfo.maps).toHaveLength(1);
        expect(dungInfo.maps[0].name).toBe("Hauteurs de l'Inglorium");
        expect(dungInfo.bossMonsterId).toBe(QILBY_MONSTER_ID);
    });
});

