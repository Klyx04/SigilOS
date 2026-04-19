import fs from 'fs';
import path from 'path';

const JSON_PATH = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');

async function enrichLayers() {
    console.log("🚀 Enriching worldmap layers (v2)...");
    
    if (!fs.existsSync(JSON_PATH)) {
        console.error("❌ worldmap.json not found");
        return;
    }

    const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    const maps = data.maps;
    
    // Index maps by [worldId, x, y]
    const coordsMap: Record<string, any[]> = {};
    maps.forEach((m: any) => {
        const key = `${m.worldMap}_${m.x}_${m.y}`;
        if (!coordsMap[key]) coordsMap[key] = [];
        coordsMap[key].push(m);
    });

    Object.entries(coordsMap).forEach(([key, group]: [string, any[]]) => {
        if (group.length > 1) {
            // Priority Heuristic
            // 1. Subarea based priority
            // SubArea 54 (Massif de Cania) -> Ground (0)
            // SubArea 76 (Routes Rocailleuses) -> Air (1) in this specific zone
            
            group.sort((a, b) => {
                // BRIGANDINS SPECIFIC logic
                const isBrigZone = (a.subAreaId === 76 || a.subAreaId === 54) && (b.subAreaId === 76 || b.subAreaId === 54);
                if (isBrigZone) {
                    if (a.subAreaId === 54) return -1; // 54 is Sol
                    if (b.subAreaId === 54) return 1;
                    return b.id - a.id; // Heuristic for same subarea
                }
                
                // General heuristic
                if (a.outdoor && !b.outdoor) return -1;
                if (!a.outdoor && b.outdoor) return 1;
                
                return a.id - b.id;
            });
            
            group.forEach((m, index) => {
                m.altitude = index;
            });
        } else {
            group[0].altitude = 0;
        }
    });

    data.maps = maps;
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Layers re-mapped successfully.`);
}

enrichLayers().catch(console.error);
