const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const HD_MAPS_DIR = path.join(ROOT, 'public', 'game-data', 'hd_maps');
const TILES_DIR = path.join(ROOT, 'public', 'game-data', 'tiles', 'w38');
const WORLDS_JSON_PATH = path.join(ROOT, 'public', 'game-data', 'worlds.json');
const WORLDMAP_JSON_PATH = path.join(ROOT, 'public', 'game-data', 'worldmap.json');

const WORLD_ID = 38;
const SUBAREA_ID = 76;

async function run() {
    console.log('🚀 Starting seamless tile generator for Village des Brigandins (World 38)...');

    if (!fs.existsSync(HD_MAPS_DIR)) fs.mkdirSync(HD_MAPS_DIR, { recursive: true });
    if (fs.existsSync(TILES_DIR)) fs.rmSync(TILES_DIR, { recursive: true, force: true });
    fs.mkdirSync(TILES_DIR, { recursive: true });

    // Step 1: Fetch map positions from DofusDB
    console.log('📡 Fetching map positions from DofusDB API...');
    let allMaps = [];
    let skip = 0;
    while (true) {
        const res = await fetch(`https://api.dofusdb.fr/map-positions?worldMap=${WORLD_ID}&$skip=${skip}&$limit=50`);
        const json = await res.json();
        if (!json.data || json.data.length === 0) break;
        allMaps.push(...json.data);
        if (allMaps.length >= json.total) break;
        skip += json.data.length;
    }

    const uniqueMapsMap = new Map();
    allMaps.forEach(m => uniqueMapsMap.set(m.id, m));
    const uniqueMaps = Array.from(uniqueMapsMap.values());
    console.log(`✅ Retrieved ${uniqueMaps.length} unique maps for World 38.`);

    // Download HD maps if missing
    for (const m of uniqueMaps) {
        const mapId = m.id;
        const targetPath = path.join(HD_MAPS_DIR, `${mapId}.webp`);
        if (fs.existsSync(targetPath)) continue;

        const imgUrl = `https://api.dofusdb.fr/img/maps/1/${mapId}.jpg`;
        try {
            console.log(`  [DOWN] Fetching map ${mapId}...`);
            const imgRes = await fetch(imgUrl);
            if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            await sharp(buffer).webp({ quality: 82 }).toFile(targetPath);
        } catch (err) {
            console.error(`  [ERR] Failed map ${mapId}: ${err.message}`);
        }
    }

    // Filter outdoor maps with valid grid coordinates
    const outdoorMaps = uniqueMaps.filter(m => m.posX < 0 && m.posY < 0);
    const xs = outdoorMaps.map(m => m.posX);
    const ys = outdoorMaps.map(m => m.posY);
    const minX = Math.min(...xs); // -19
    const maxX = Math.max(...xs); // -14
    const minY = Math.min(...ys); // -25
    const maxY = Math.max(...ys); // -20

    const cols = maxX - minX + 1; // 6 cols (-19, -18, -17, -16, -15, -14)
    const rows = maxY - minY + 1; // 6 rows (-25, -24, -23, -22, -21, -20)

    // Standard Dofus secondary world map cell dimensions
    const mapWidth = 209;
    const mapHeight = 150;
    const totalW = cols * mapWidth;  // 1254px
    const totalH = rows * mapHeight; // 900px

    const origineX = -minX * mapWidth;   // -(-19) * 209 = 3971
    const origineY = -minY * mapHeight;  // -(-25) * 150 = 3750

    console.log(`📐 Grid Bounds: X [${minX}..${maxX}] (${cols} cols), Y [${minY}..${maxY}] (${rows} rows)`);
    console.log(`📐 Exact World Dimensions: totalW=${totalW}px, totalH=${totalH}px, origineX=${origineX}, origineY=${origineY}`);

    // Create composite world map image
    console.log(`🖼️ Creating composite world map image with 4:3 active map viewport crop...`);
    const overlays = [];
    for (const m of outdoorMaps) {
        const file = path.join(HD_MAPS_DIR, `${m.id}.webp`);
        if (!fs.existsSync(file)) continue;

        const gridX = m.posX - minX;
        const gridY = m.posY - minY;
        const left = gridX * mapWidth;
        const top = gridY * mapHeight;

        // Crop 4:3 active Dofus map viewport (strip 16:9 widescreen margins & header/footer bars)
        // 1910x970 -> crop left 368px, top 45px, width 1173px, height 880px -> resize to 209x150
        const croppedAndResizedBuf = await sharp(file)
            .extract({ left: 368, top: 45, width: 1173, height: 880 })
            .resize(mapWidth, mapHeight, { fit: 'fill' })
            .toBuffer();

        overlays.push({ input: croppedAndResizedBuf, left, top });
    }

    const compositeBuffer = await sharp({
        create: {
            width: totalW,
            height: totalH,
            channels: 4,
            background: { r: 8, g: 11, b: 18, alpha: 1 }
        }
    })
    .composite(overlays)
    .webp({ quality: 90 })
    .toBuffer();

    console.log('✅ Seamless composite world map generated.');

    // Step 4: Tile Pyramid Generation (Leaflet 250px tiles)
    const tileSize = 250;
    const scaleBanks = [
        { name: '1', scale: 1 },
        { name: '0.75', scale: 0.75 },
        { name: '0.5', scale: 0.5 },
        { name: '0.25', scale: 0.25 },
        { name: 'custom2', scale: 2 },
        { name: 'custom3', scale: 3 }
    ];

    console.log('🧱 Generating pixel-perfect tile pyramid...');
    for (const b of scaleBanks) {
        const bankDir = path.join(TILES_DIR, b.name);
        if (!fs.existsSync(bankDir)) fs.mkdirSync(bankDir, { recursive: true });

        const scaledW = Math.round(totalW * b.scale);
        const scaledH = Math.round(totalH * b.scale);

        const scaledWorldBuf = await sharp(compositeBuffer)
            .resize(scaledW, scaledH, { fit: 'fill' })
            .toBuffer();

        const numCols = Math.ceil(scaledW / tileSize);
        const numRows = Math.ceil(scaledH / tileSize);

        let tileTasks = [];
        let tileIndex = 1;

        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const cropLeft = c * tileSize;
                const cropTop = r * tileSize;
                const cropW = Math.min(tileSize, scaledW - cropLeft);
                const cropH = Math.min(tileSize, scaledH - cropTop);
                const tilePath = path.join(bankDir, `${tileIndex}.webp`);
                tileIndex++;

                tileTasks.push(async () => {
                    let tilePipeline = sharp(scaledWorldBuf).extract({
                        left: cropLeft,
                        top: cropTop,
                        width: cropW,
                        height: cropH
                    });

                    if (cropW !== tileSize || cropH !== tileSize) {
                        tilePipeline = tilePipeline.extend({
                            top: 0,
                            left: 0,
                            bottom: tileSize - cropH,
                            right: tileSize - cropW,
                            background: { r: 8, g: 11, b: 18, alpha: 0 }
                        });
                    }

                    await tilePipeline.webp({ quality: 80 }).toFile(tilePath);
                });
            }
        }

        const batchSize = 40;
        for (let i = 0; i < tileTasks.length; i += batchSize) {
            await Promise.all(tileTasks.slice(i, i + batchSize).map(fn => fn()));
        }
        console.log(`  [BANK ${b.name}] Done (${numCols}x${numRows} tiles).`);
    }

    // Step 5: Update worlds.json
    console.log('📄 Updating worlds.json...');
    const worldsData = JSON.parse(fs.readFileSync(WORLDS_JSON_PATH, 'utf-8'));

    const world38Entry = {
        _id: "69a716cb96df4304dfe0af99",
        id: WORLD_ID,
        origineX: origineX,
        origineY: origineY,
        mapWidth: mapWidth,
        mapHeight: mapHeight,
        minScale: 0.25,
        maxScale: 1,
        startScale: 0.5,
        totalWidth: totalW,
        totalHeight: totalH,
        zoom: [1, 0.75, 0.5, 0.25],
        visibleOnMap: true,
        name: {
            de: "Dorf der Brigandiner",
            en: "Imp Village",
            es: "Pueblo de los salteadorillos",
            fr: "Village des Brigandins",
            pt: "Vilarejo dos Diabretes"
        },
        className: "WorldMapData",
        m_id: WORLD_ID,
        customScales: [
            { x: 3, y: 3, name: "custom3" },
            { x: 2, y: 2, name: "custom2" },
            { x: 1, y: 1, name: "1" },
            { x: 0.75, y: 0.75, name: "0.75" },
            { x: 0.5, y: 0.5, name: "0.5" },
            { x: 0.25, y: 0.25, name: "0.25" }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const idx = worldsData.findIndex(w => w.id === WORLD_ID);
    if (idx >= 0) worldsData[idx] = world38Entry;
    else worldsData.push(world38Entry);

    fs.writeFileSync(WORLDS_JSON_PATH, JSON.stringify(worldsData, null, 2), 'utf-8');
    console.log('✅ worlds.json updated!');

    // Step 6: Update worldmap.json
    console.log('📄 Updating worldmap.json...');
    const wm = JSON.parse(fs.readFileSync(WORLDMAP_JSON_PATH, 'utf-8'));

    if (wm.worlds) {
        const wIdx = wm.worlds.findIndex(w => w.id === WORLD_ID);
        if (wIdx >= 0) wm.worlds[wIdx] = world38Entry;
        else wm.worlds.push(world38Entry);
    }

    if (wm.maps) {
        for (const m of wm.maps) {
            if (m.subAreaId === SUBAREA_ID) {
                m.worldMap = WORLD_ID;
            }
        }
    }

    fs.writeFileSync(WORLDMAP_JSON_PATH, JSON.stringify(wm, null, 2), 'utf-8');
    console.log('✅ worldmap.json updated!');

    console.log('🎉 Seamless tile generation complete for World 38!');
}

run().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
