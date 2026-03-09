const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const map = data.maps.find(m => m.x === 21 && m.y === 10 && m.worldMap === 1);
console.log('Map [21, 10]:', !!map);
if (map) console.log(JSON.stringify(map, null, 2));
