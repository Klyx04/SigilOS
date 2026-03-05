import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.dofusdb.fr';
const DATA_DIR = path.join(process.cwd(), 'public', 'game-data');

async function fetchAll(endpoint: string) {
    let allData: any[] = [];
    let skip = 0;
    const limit = 50;
    let total = 1;

    console.log(`Fetching ${endpoint}...`);

    while (skip < total) {
        const response = await fetch(`${API_BASE}${endpoint}?$limit=${limit}&$skip=${skip}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
        }
        const data = await response.json();

        if (skip === 0) {
            total = data.total || data.data.length;
        }

        allData = allData.concat(data.data);
        skip += limit;

        if (skip % 500 === 0) {
            console.log(`Fetched ${Math.min(skip, total)} / ${total} items...`);
        }
    }

    console.log(`Finished fetching ${allData.length} items for ${endpoint}.`);
    return allData;
}

async function main() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        // 1. Fetch data
        const areas = await fetchAll('/areas');
        const subareas = await fetchAll('/subareas');

        // Note: map-positions API returns a huge amount of data. 
        // We only extract what we really need to keep the JSON size small.
        const mapPositions = await fetchAll('/map-positions');

        // 2. Process and optimize the data
        const optimizedAreas = areas.map((a: any) => ({
            id: a.id,
            name: a.name?.fr || a.name?.en || 'Inconnu'
        }));

        const optimizedSubareas = subareas.map((sa: any) => ({
            id: sa.id,
            areaId: sa.areaId,
            name: sa.name?.fr || sa.name?.en || 'Inconnu',
            level: sa.level
        }));

        const optimizedMapPositions = mapPositions.map((mp: any) => ({
            id: mp.id,
            x: mp.posX,
            y: mp.posY,
            subAreaId: mp.subAreaId,
            worldMap: mp.worldMap,
            outdoor: mp.outdoor
        }));

        const worldMapData = {
            areas: optimizedAreas,
            subareas: optimizedSubareas,
            maps: optimizedMapPositions,
            updatedAt: new Date().toISOString()
        };

        // 3. Save to disk
        const filePath = path.join(DATA_DIR, 'worldmap.json');
        fs.writeFileSync(filePath, JSON.stringify(worldMapData));

        console.log(`✅ Success! Worldmap data saved to ${filePath}`);
        console.log(`Total maps size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
        console.error('❌ Error synchronizing worldmap data:', error);
        process.exit(1);
    }
}

main();
