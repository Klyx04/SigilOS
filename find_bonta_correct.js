const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const maps = data.maps.filter(m => m.subAreaId === 279);
if (maps.length > 0) {
    const minX = Math.min(...maps.map(m => m.x));
    const maxX = Math.max(...maps.map(m => m.x));
    const minY = Math.min(...maps.map(m => m.y));
    const maxY = Math.max(...maps.map(m => m.y));
    console.log(`SubArea 279 bounds: X[${minX}, ${maxX}], Y[${minY}, ${maxY}]`);
}
const centerBonta = data.subareas.find(s => s.name === "Bonta");
console.log('Center Bonta SubArea:', centerBonta);
