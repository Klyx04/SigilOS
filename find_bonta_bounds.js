const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const bontaMaps = data.maps.filter(m => m.subAreaId === 32);
if (bontaMaps.length > 0) {
    const minX = Math.min(...bontaMaps.map(m => m.x));
    const maxX = Math.max(...bontaMaps.map(m => m.x));
    const minY = Math.min(...bontaMaps.map(m => m.y));
    const maxY = Math.max(...bontaMaps.map(m => m.y));
    console.log(`Bonta bounds: X[${minX}, ${maxX}], Y[${minY}, ${maxY}]`);
} else {
    console.log('Bonta not found');
}
