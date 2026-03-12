
const fs = require('fs');
const content = fs.readFileSync('a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx', 'utf8');

let level = 0;
let lastLevel0Line = 0;
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    
    const prevLevel = level;
    level += (opens - closes);
    
    if (prevLevel > 0 && level === 0) {
        console.log(`L${i+1}: Scope level dropped to 0. (Current line: ${line.trim()})`);
    }
}
