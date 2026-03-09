const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const maps = data.maps.filter(m => m.worldMap === 1 && m.x === -32);
console.log('Maps with x=-32 on world 1:');
maps.forEach(m => console.log(`[${m.x}, ${m.y}] - subArea: ${m.subAreaId}`));
