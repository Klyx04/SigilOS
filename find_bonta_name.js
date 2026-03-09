const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const bonta = data.subareas.find(s => s.name.includes('Bonta'));
console.log('Bonta SubArea:', bonta);
