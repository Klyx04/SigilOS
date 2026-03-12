const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:\\SigilOS\\public\\game-data\\worldmap.json', 'utf8'));

const testMaps = data.maps.filter(m => m.worldMap === -1);
console.log("Total -1 maps:", testMaps.length);
const atZeroZero = testMaps.filter(m => m.x === 0 && m.y === 0);
console.log("-1 maps at [0,0]:", atZeroZero.length);

const referencedByDungeon = new Set(data.dungeons.map(d => d.mapId || d.entranceMapId));
const invalidButReferenced = testMaps.filter(m => referencedByDungeon.has(m.id));
console.log("-1 maps referenced by dungeons:", invalidButReferenced.length);
invalidButReferenced.slice(0, 10).forEach(m => {
    const d = data.dungeons.find(d => (d.mapId || d.entranceMapId) === m.id);
    console.log(`Dungeon: ${d.name} -> [${m.x}, ${m.y}] WorldMap: ${m.worldMap}`);
});
