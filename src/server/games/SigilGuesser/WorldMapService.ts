import fs from 'fs';
import path from 'path';

export interface MapData {
    id: number;
    x: number;
    y: number;
    worldMap: number;
    outdoor: boolean;
}

export class WorldMapService {
    private static instance: WorldMapService;
    private maps = new Map<number, MapData>();
    private playableMaps: MapData[] = [];
    private isLoaded = false;

    private constructor() {}

    public static getInstance(): WorldMapService {
        if (!WorldMapService.instance) {
            WorldMapService.instance = new WorldMapService();
        }
        return WorldMapService.instance;
    }

    public loadData() {
        if (this.isLoaded) return;
        try {
            const filePath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);

            if (data.maps) {
                data.maps.forEach((m: any) => {
                    this.maps.set(m.id, {
                        id: m.id,
                        x: m.x,
                        y: m.y,
                        worldMap: m.worldMap,
                        outdoor: m.outdoor
                    });

                    // Pre-filter playable maps (outdoor, valid world)
                    if (m.outdoor && m.worldMap !== -1) {
                        this.playableMaps.push(m);
                    }
                });
            }
            this.isLoaded = true;
            console.log(`[WorldMapService] 🗺️ ${this.maps.size} maps loaded (${this.playableMaps.length} playable)`);
        } catch (error) {
            console.error('[WorldMapService] ❌ Failed to load worldmap data:', error);
        }
    }

    public getMap(id: number): MapData | undefined {
        return this.maps.get(id);
    }

    public getRandomMaps(count: number, mode: 'NORMAL' | 'SPECIAL' = 'NORMAL'): number[] {
        let filtered = this.playableMaps;
        if (mode === 'NORMAL') {
            filtered = filtered.filter(m => m.worldMap === 1);
        } else {
            // Mode SPECIAL: Exclude World 1, World 19 (Mappemondes), World 29 (Ecaflip City)
            filtered = filtered.filter(m => m.worldMap !== 1 && m.worldMap !== 19 && m.worldMap !== 29);
        }

        if (filtered.length === 0) return [];

        const result: number[] = [];
        const copy = [...filtered];
        for (let i = 0; i < count; i++) {
            if (copy.length === 0) break;
            const idx = Math.floor(Math.random() * copy.length);
            result.push(copy[idx].id);
            copy.splice(idx, 1); // Avoid duplicates
        }
        return result;
    }

    public calculateScore(mapId: number, guessX: number, guessY: number, guessWorldId: number): { distance: number, score: number } {
        const target = this.getMap(mapId);
        if (!target) return { distance: 1000, score: 0 };

        let distance = 1000;
        if (target.worldMap === guessWorldId) {
            const dx = guessX - target.x;
            const dy = guessY - target.y;
            distance = Math.round(Math.sqrt(dx * dx + dy * dy));
        }

        const maxDistPossible = 100;
        let score = 0;
        if (distance < maxDistPossible) {
            score = Math.round(1000 * Math.pow(1 - distance / maxDistPossible, 2));
        }

        // Difficulty Bonus for exact guesses
        if (distance === 0) {
            // Standard bonus for server-side score calculation
            score += 250; 
        }

        return { distance, score };
    }
}
