import fs from 'fs';
import path from 'path';

async function syncWorldMap() {
    console.log('🔄 Fetching game data from DofusDB (Stable API)...');

    const worldsRes = await fetch('https://api.dofusdb.fr/worlds?\$limit=100&lang=fr');
    const worldsJson = await worldsRes.json();
    const worldsData = worldsJson.data;
    fs.writeFileSync(path.join(process.cwd(), 'public/game-data/worlds.json'), JSON.stringify(worldsData, null, 2));
    console.log(`✅ Saved ${worldsData.length} worlds definitions.`);

    const subAreasRes = await fetch('https://api.dofusdb.fr/subareas?\$limit=5000&lang=fr');
    const subAreasJson = await subAreasRes.json();
    const subAreasData = subAreasJson.data;
    const subAreas = subAreasData.map((s: any) => ({
        id: s.id,
        name: s.name.fr,
        areaId: s.areaId,
        level: s.level
    }));
    console.log(`✅ Saved ${subAreas.length} subareas.`);

    const dungeonsRes = await fetch('https://api.dofusdb.fr/dungeons?$limit=1');
    const dTotal = (await dungeonsRes.json()).total;
    let allDungeons: any[] = [];
    let dSkip = 0;
    while (dSkip < dTotal) {
        const dr = await fetch(`https://api.dofusdb.fr/dungeons?$limit=50&$skip=${dSkip}`);
        const dj = await dr.json();
        if (!dj.data || dj.data.length === 0) break;

        allDungeons = allDungeons.concat(dj.data.map((d: any) => ({
            id: d.id,
            name: d.name?.fr || "Donjon inconnu",
            optimalPlayerLevel: d.optimalPlayerLevel,
            entranceMapId: d.entranceMapId
        })));
        dSkip += dj.data.length;
        await new Promise(r => setTimeout(r, 50));
    }
    console.log(`✅ Saved ${allDungeons.length} dungeons.`);

    let allMaps: any[] = [];
    let skip = 0;
    let total = 16000; // Expected

    console.log('📡 Starting sequential download with progressive skip...');

    while (skip < total) {
        const res = await fetch(`https://api.dofusdb.fr/map-positions?\$limit=50&\$skip=${skip}`);
        const data = await res.json();

        if (!data.data || data.data.length === 0) break;

        total = data.total;
        const processed = data.data.map((m: any) => ({
            id: m.id,
            x: m.posX,
            y: m.posY,
            subAreaId: m.subAreaId,
            worldMap: m.worldMap,
            outdoor: !!m.outdoor
        }));

        allMaps = allMaps.concat(processed);
        skip += data.data.length; // IMPORTANT: skip by number of items received

        console.log(`📊 Progress: ${allMaps.length} / ${total} (skip: ${skip})`);

        // Tiny delay to avoid IP ban
        await new Promise(r => setTimeout(r, 50));
    }

    const result = {
        subareas: subAreas,
        dungeons: allDungeons,
        maps: allMaps,
        updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(
        path.join(process.cwd(), 'public/game-data/worldmap.json'),
        JSON.stringify(result)
    );

    console.log(`🚀 Final result: ${allMaps.length} maps across all worlds.`);
}

syncWorldMap().catch(console.error);
