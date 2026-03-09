const fs = require('fs');
const data = JSON.parse(fs.readFileSync('a:/SigilOS/public/game-data/worldmap.json', 'utf8'));
const bontas = data.subareas.filter(s => s.name.includes('Bonta'));
bontas.forEach(s => {
    const maps = data.maps.filter(m => m.subAreaId === s.id);
    if (maps.length > 0) {
        const minX = Math.min(...maps.map(m => m.x));
        const maxX = Math.max(...maps.map(m => m.x));
        const minY = Math.min(...maps.map(m => m.y));
        const maxY = Math.max(...maps.map(m => m.y));
        console.log(`${s.name} (${s.id}): X[${minX}, ${maxX}], Y[${minY}, ${maxY}]`);
    }
});
