const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const subArea = data.subareas.find(s => s.id === 320);
console.log('SubArea 320:', subArea?.name);
