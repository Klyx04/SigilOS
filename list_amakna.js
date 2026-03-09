const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const list = data.subareas.filter(s => s.name.toLowerCase().includes('amakna')).slice(0, 5);
list.forEach(s => console.log(s.name, s.id));
