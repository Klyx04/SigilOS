const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const map25 = data.maps.find(m => m.x === -25 && m.y === -53 && m.worldMap === 1);
const map26 = data.maps.find(m => m.x === -26 && m.y === -53 && m.worldMap === 1);
console.log('Map -25:', !!map25);
console.log('Map -26:', !!map26);
