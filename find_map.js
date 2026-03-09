const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const map = data.maps.find(m => m.x === -2 && m.y === 0 && m.worldMap === 1);
console.log(JSON.stringify(map, null, 2));
