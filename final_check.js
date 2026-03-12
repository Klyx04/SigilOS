
const fs = require('fs');
const content = fs.readFileSync('a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx', 'utf8');
const lines = content.split('\n');

let level = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/<div\b/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    const motionOpens = (line.match(/<motion.div\b/g) || []).length;
    const motionCloses = (line.match(/<\/motion.div>/g) || []).length;
    
    level += (opens + motionOpens - closes - motionCloses);
    
    if (line.includes('Sigil-Guesser') || line.includes('Sigil-Draw') || line.includes('Sigil-Phone') || line.includes('Leaderboard Sidebar')) {
        console.log(`L${i+1}: Level ${level} | ${line.trim()}`);
    }
}
console.log(`Final level: ${level}`);
