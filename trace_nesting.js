
const fs = require('fs');
const content = fs.readFileSync('a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx', 'utf8');
const lines = content.split('\n');

let level = 0;
for (let i = 968; i < 1240; i++) { // Lines 969 to 1240 (0-indexed: 968 to 1239)
    const line = lines[i];
    if (!line) continue;
    const opens = (line.match(/<div\b/g) || []).length;
    const selfCloses = (line.match(/\/>/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    const exprOpens = (line.match(/\{/g) || []).length;
    const exprCloses = (line.match(/\}/g) || []).length;
    
    level += (opens - selfCloses - closes);
    console.log(`${i+1}: Level ${level} | +${opens} -${closes} | Expr: +${exprOpens} -${exprCloses} | ${line.trim()}`);
}
