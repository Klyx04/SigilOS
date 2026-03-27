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
    private blacklist = new Set<number>();
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

            const excludedKeywords = [
                // General Interiors/Dungeons
                "donjon", "tunnel", "souterrain", "cave", "crypt", "labyrinthe", 
                "bâtiment", "intérieur", "tactique", "défis", "arène", "mine", 
                "égout", "cellule", "prison", "temple", "salle", "château",
                "laboratoire", "secret", "caché", "salle du trône", "boss",
                
                // Divine Dimensions (Usually hard to guess/find)
                "dimension", "ecaflipus", "enutrosor", "srambad", "xelorium", 
                "écafli", "énutro", "sram", "xélor", "défi",
                
                // Specific Bosses/Areas
                "chaloeil", "vortex", "nidas", "reine des voleurs", "koutoulou", 
                "dantinéa", "meno", "merkab", "trône", "sommet", "antre",
                "fond de la mer", "profondeurs", "obscur", "sombre", "cachot",
                "laboratoire", "infirmerie", "forge", "atelier", "bibliothèque",
                "taverne", "maison", "villa", "palais", "résidence"
            ];

            const subAreaNames = new Map<number, string>();
            if (data.subareas) {
                // Also load subarea names from a different property if possible
                data.subareas.forEach((s: any) => {
                    const nameFR = s.nameFR || s.name_fr || (typeof s.name === 'string' ? s.name : s.name?.fr || "");
                    const name = nameFR.toLowerCase();
                    subAreaNames.set(s.id, name);
                });
            }

            this.playableMaps = []; // Clear current list for reload
            if (data.maps) {
                data.maps.forEach((m: any) => {
                    const subAreaName = subAreaNames.get(m.subAreaId) || "";
                    const isExcluded = excludedKeywords.some(key => subAreaName.includes(key));

                    // Strict check: must be outdoor AND from a primary world map AND not excluded by keyword
                    // We only allow World 1 (Amakna) and World 2 (Incarnam) as "Playable" origins for special mode
                    // Tunnels (World 3) and small labyrinths (World 4, 5, 6...) are excluded.
                    const isMainWorld = m.worldMap === 1 || m.worldMap === 2;
                    
                    if (m.outdoor && m.worldMap !== -1 && isMainWorld && !isExcluded) {
                        this.playableMaps.push({
                            id: m.id,
                            x: m.x,
                            y: m.y,
                            worldMap: m.worldMap,
                            outdoor: m.outdoor
                        });
                    }
                    
                    this.maps.set(m.id, {
                        id: m.id,
                        x: m.x,
                        y: m.y,
                        worldMap: m.worldMap,
                        outdoor: m.outdoor
                    });
                });
            }
            this.isLoaded = true;
            
            const stats: Record<number, number> = {};
            this.playableMaps.forEach(m => {
                stats[m.worldMap] = (stats[m.worldMap] || 0) + 1;
            });
            console.log(`[WorldMapService] 🗺️ ${this.maps.size} maps loaded. Playable stats:`, stats);
        } catch (error) {
            console.error('[WorldMapService] ❌ Failed to load worldmap data:', error);
        }
    }

    public getMap(id: number): MapData | undefined {
        return this.maps.get(id);
    }

    public getRandomMaps(count: number, mode: 'NORMAL' | 'SPECIAL' = 'NORMAL'): number[] {
        let filtered = this.playableMaps;
        
        // Apply blacklist filtering
        if (this.blacklist.size > 0) {
            filtered = filtered.filter(m => !this.blacklist.has(m.id));
        }

        if (mode === 'NORMAL') {
            // Normal mode is World of Twelve (Amakna)
            filtered = filtered.filter(m => m.worldMap === 1);
        } else {
            // Mode SPECIAL: Include Incarnam (World 2) and others if allowed, 
            // but we usually want to stay on identifiable maps.
            // Exclude World 1, World 19 (Mappemondes), World 29 (Ecaflip City)
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
            // Dofus uses Manhattan distance for maps
            distance = Math.abs(dx) + Math.abs(dy);
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

    public setBlacklist(ids: number[]) {
        this.blacklist = new Set(ids);
        console.log(`[WorldMapService] 🚫 Blacklist updated with ${ids.length} maps.`);
    }
}
