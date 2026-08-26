const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORLDS_JSON_PATH = path.join(ROOT, 'public', 'game-data', 'worlds.json');
const WORLDMAP_JSON_PATH = path.join(ROOT, 'public', 'game-data', 'worldmap.json');

// Mondes raides Dofus 3 à siphonner
const WORLDS = [37, 40];

async function fetchPaginated(baseUrl) {
    let all = [];
    let skip = 0;
    let total = Infinity;
    while (skip < total) {
        const sep = baseUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${baseUrl}${sep}$skip=${skip}&$limit=100`);
        const json = await res.json();
        if (!json.data || json.data.length === 0) break;
        total = json.total;
        all = all.concat(json.data);
        skip += json.data.length;
    }
    return all;
}

async function run() {
    const worldsData = JSON.parse(fs.readFileSync(WORLDS_JSON_PATH, 'utf-8'));
    const wm = JSON.parse(fs.readFileSync(WORLDMAP_JSON_PATH, 'utf-8'));
    if (!wm.subareas) wm.subareas = [];
    if (!wm.maps) wm.maps = [];
    if (!wm.worlds) wm.worlds = [];

    for (const worldId of WORLDS) {
        console.log(`\n=== Monde ${worldId} ===`);

        // 1. Objet monde officiel
        const wRes = await fetch(`https://api.dofusdb.fr/worlds/${worldId}`);
        const world = await wRes.json();
        if (!world._id) world._id = `custom_world_${worldId}`;
        if (!world.customScales) world.customScales = [];
        console.log(`  monde: ${world.name?.fr} (${world.totalWidth}x${world.totalHeight})`);

        // 2. Cartes (positions)
        const maps = await fetchPaginated(`https://api.dofusdb.fr/map-positions?worldMap=${worldId}`);
        const cleanedMaps = maps.map(m => ({
            id: m.id,
            x: m.posX,
            y: m.posY,
            subAreaId: m.subAreaId,
            worldMap: m.worldMap,
            outdoor: !!m.outdoor
        }));
        console.log(`  cartes: ${cleanedMaps.length}`);

        // 3. Sous-zones (le champ customWorldMapId ne se filtre pas via l'API, on filtre localement)
        const allSubareas = await fetchPaginated(`https://api.dofusdb.fr/subareas`);
        const subareas = allSubareas.filter(s => s.customWorldMapId === worldId);
        const cleanedSubareas = subareas.map(s => ({
            id: s.id,
            name: s.name?.fr || "Zone Inconnue",
            areaId: s.areaId,
            level: s.level
        }));
        console.log(`  sous-zones: ${cleanedSubareas.length}`);

        // 4. worlds.json
        const wIdx = worldsData.findIndex(w => w.id === worldId);
        if (wIdx >= 0) worldsData[wIdx] = world;
        else worldsData.push(world);

        // 5. worldmap.json — sous-zones
        for (const sa of cleanedSubareas) {
            if (!wm.subareas.some(x => x.id === sa.id)) wm.subareas.push(sa);
        }

        // 6. worldmap.json — cartes (retire les éventuelles cartes existantes du monde puis ajoute)
        wm.maps = wm.maps.filter(m => m.worldMap !== worldId);
        wm.maps.push(...cleanedMaps);

        // 7. worldmap.json — worlds[]
        const wmWorldEntry = { ...world, customScales: world.customScales };
        const wmIdx = wm.worlds.findIndex(w => w.id === worldId);
        if (wmIdx >= 0) wm.worlds[wmIdx] = wmWorldEntry;
        else wm.worlds.push(wmWorldEntry);
    }

    fs.writeFileSync(WORLDS_JSON_PATH, JSON.stringify(worldsData, null, 2), 'utf-8');
    console.log('\n✅ worlds.json mis à jour');

    fs.writeFileSync(WORLDMAP_JSON_PATH, JSON.stringify(wm, null, 2), 'utf-8');
    console.log('✅ worldmap.json mis à jour');
}

run().catch(e => { console.error('❌ Erreur fatale:', e); process.exit(1); });
