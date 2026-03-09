const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const bonta = data.maps.find(m => m.subAreaId === 32); // Bonta center?
console.log('Bonta maps:', data.maps.filter(m => m.subAreaId === 32).length);
const bontaZaap = data.maps.find(m => m.subAreaId === 32 && m.x === -32 && m.y === -56);
console.log('Bonta Zaap [-32, -56]:', !!bontaZaap);
