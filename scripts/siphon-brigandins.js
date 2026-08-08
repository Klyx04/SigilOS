const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const HD_MAPS_DIR = path.join(ROOT, 'public', 'game-data', 'hd_maps');
const TILES_DIR = path.join(ROOT, 'public', 'game-data', 'tiles', 'w38');
const WORLDS_JSON_PATH = path.join(ROOT, 'public', 'game-data', 'worlds.json');
const WORLDMAP_JSON_PATH = path.join(ROOT, 'public', 'game-data', 'worldmap.json');

// Target World ID & SubArea ID for Village des Brigandins
const WORLD_ID = 38;
const SUBAREA_ID = 76;

async function run() {
    console.log('🚀 Starting siphonment for Village des Brigandins (World 38)...');

    // Ensure directories exist
    if (!fs.existsSync(HD_MAPS_DIR)) fs.mkdirSync(HD_MAPS_DIR, { recursive: true });
    if (!fs.existsSync(TILES_DIR)) fs.mkdirSync(TILES_DIR, { recursive: true });

    // Step 1: Fetch all map positions for World 38
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

    // Deduplicate by map ID
    const uniqueMapsMap = new Map();
    allMaps.forEach(m => uniqueMapsMap.set(m.id, m));
    const uniqueMaps = Array.from(uniqueMapsMap.values());
    console.log(`✅ Retrieved ${uniqueMaps.length} unique maps for World 38.`);

    // Step 2: Download HD Map Images and save as WebP
    console.log('🖼️ Downloading HD map images...');
    for (const m of uniqueMaps) {
        const mapId = m.id;
        const targetPath = path.join(HD_MAPS_DIR, `${mapId}.webp`);
        if (fs.existsSync(targetPath)) {
            console.log(`  [SKIP] ${mapId}.webp already exists.`);
            continue;
        }

        const imgUrl = `https://api.dofusdb.fr/img/maps/1/${mapId}.jpg`;
        try {
            console.log(`  [DOWN] Fetching map ${mapId} from ${imgUrl}...`);
            const imgRes = await fetch(imgUrl);
            if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
            const arrayBuffer = await imgRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await sharp(buffer)
                .webp({ quality: 82 })
                .toFile(targetPath);
            console.log(`  [OK] Saved ${mapId}.webp`);
        } catch (err) {
            console.error(`  [ERR] Failed to download map ${mapId}: ${err.message}`);
        }
    }

    // Step 3: Compute World Grid Bounds
    const xs = uniqueMaps.map(m => m.posX);
    const ys = uniqueMaps.map(m => m.posY);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    console.log(`📐 Grid Bounds: X [${minX}..${maxX}] (${cols} cols), Y [${minY}..${maxY}] (${rows} rows)`);

    // Individual map cell dimensions for compositing
    const cellW = 400;
    const cellH = 260;
    const totalW = cols * cellW;
    const totalH = rows * cellH;

    console.log(`🖼️ Creating composite world map canvas (${totalW}x${totalH}px)...`);

    // Prepare Sharp composition overlays
    const overlays = [];
    for (const m of uniqueMaps) {
        const mapId = m.id;
        const file = path.join(HD_MAPS_DIR, `${mapId}.webp`);
        if (!fs.existsSync(file)) continue;

        const gridX = m.posX - minX;
        const gridY = m.posY - minY;
        const left = gridX * cellW;
        const top = gridY * cellH;

        // Resize individual map cell to fit composite cell
        const resizedBuf = await sharp(file)
            .resize(cellW, cellH, { fit: 'fill' })
            .toBuffer();

        overlays.push({
            input: resizedBuf,
            left: left,
            top: top
        });
    }

    // Generate base world composite image
    const compositeBuffer = await sharp({
        create: {
            width: totalW,
            height: totalH,
            channels: 4,
            background: { r: 10, g: 15, b: 24, alpha: 1 }
        }
    })
    .composite(overlays)
    .webp({ quality: 85 })
    .toBuffer();

    console.log('✅ Composite world map generated.');

    // Step 4: Generate Tile Pyramid
    const tileSize = 250;
    const scaleBanks = [
        { name: '1', scale: 1 },
        { name: '0.75', scale: 0.75 },
        { name: '0.5', scale: 0.5 },
        { name: '0.25', scale: 0.25 },
        { name: 'custom2', scale: 2 },
        { name: 'custom3', scale: 3 },
        { name: 'custom4', scale: 4 },
        { name: 'custom5', scale: 5 }
    ];

    console.log('🧱 Generating tile pyramid...');
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

        console.log(`  [BANK ${b.name}] Dimension: ${scaledW}x${scaledH}px -> ${numCols}x${numRows} tiles`);

        let tileIndex = 1;
        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const cropLeft = c * tileSize;
                const cropTop = r * tileSize;
                const cropW = Math.min(tileSize, scaledW - cropLeft);
                const cropH = Math.min(tileSize, scaledH - cropTop);

                const tilePath = path.join(bankDir, `${tileIndex}.webp`);

                // Extract & pad tile to exactly tileSize x tileSize if edge tile
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
                        background: { r: 10, g: 15, b: 24, alpha: 0 }
                    });
                }

                await tilePipeline.webp({ quality: 80 }).toFile(tilePath);
                tileIndex++;
            }
        }
    }
    console.log('✅ Tile pyramid generated successfully.');

    // Step 5: Update worlds.json
    console.log('📄 Updating worlds.json...');
    const worldsJsonRaw = fs.readFileSync(WORLDS_JSON_PATH, 'utf-8');
    const worldsData = JSON.parse(worldsJsonRaw);

    const world38Entry = {
        _id: "69a716cb96df4304dfe0af99",
        id: WORLD_ID,
        origineX: 3971,
        origineY: 5225,
        mapWidth: 209,
        mapHeight: 150,
        minScale: 0.25,
        maxScale": 1,
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
            { x: 5, y: 5, name: "custom5" },
            { x: 4, y: 4, name: "custom4" },
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

    const existingIndex = worldsData.findIndex(w => w.id === WORLD_ID);
    if (existingIndex >= 0) {
        worldsData[existingIndex] = { ...worldsData[existingIndex], ...world38Entry };
    } else {
        worldsData.push(world38Entry);
    }

    fs.writeFileSync(WORLDS_JSON_PATH, JSON.stringify(worldsData, null, 2), 'utf-8');
    console.log('✅ worlds.json updated with World 38.');

    // Step 6: Update worldmap.json
    console.log('📄 Updating worldmap.json...');
    const worldmapRaw = fs.readFileSync(WORLDMAP_JSON_PATH, 'utf-8');
    const worldmapData = JSON.parse(worldmapRaw);

    // Merge worlds in worldmapData
    if (worldmapData.worlds) {
        const idxInWorldmap = worldmapData.worlds.findIndex(w => w.id === WORLD_ID);
        if (idxInWorldmap >= 0) {
            worldmapData.worlds[idxInWorldmap] = world38Entry;
        } else {
            worldmapData.worlds.push(world38Entry);
        }
    }

    // Merge maps into worldmapData.maps
    if (worldmapData.maps) {
        const existingMapIds = new Set(worldmapData.maps.map(m => m.id));
        for (const m of uniqueMaps) {
            if (!existingMapIds.has(m.id)) {
                worldmapData.maps.push({
                    id: m.id,
                    x: m.posX,
                    y: m.posY,
                    worldMap: WORLD_ID,
                    subAreaId: SUBAREA_ID,
                    outdoor: m.outdoor !== false
                });
            }
        }
    }

    fs.writeFileSync(WORLDMAP_JSON_PATH, JSON.stringify(worldmapData, null, 2), 'utf-8');
    console.log('✅ worldmap.json updated with World 38 maps.');

    console.log('🎉 Siphonment & Tile Generation completed successfully!');
}

run().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
