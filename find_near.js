const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const maps = data.maps.filter(m => m.worldMap === 1 && m.x > 15 && m.x < 25 && m.y > 5 && m.y < 15);
console.log('Maps near [21, 10]:');
maps.forEach(m => console.log(`[${m.x}, ${m.y}]`));
