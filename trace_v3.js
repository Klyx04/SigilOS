
const fs = require('fs');
const content = fs.readFileSync('a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx', 'utf8');

let level = 0;
const lines = content.split('\n');
const tagRegex = /<([a-zA-Z0-9.-]+)([^>]*?)(\/?)>|<\/([a-zA-Z0-9.-]+)>/g;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
        const fullTag = match[0];
        const tagName = match[1] || match[4];
        const isClosing = fullTag.startsWith('</');
        const isSelfClosing = match[3] === '/';
        
        if (['div', 'motion.div', 'span', 'button', 'a'].includes(tagName.toLowerCase()) || tagName[0] === tagName[0].toUpperCase()) {
            if (isClosing) {
                level--;
            } else if (!isSelfClosing) {
                level++;
            }
        }
    }
    if (i+1 === 960 || i+1 === 970 || i+1 === 992 || i+1 === 1230 || i+1 === 1240) {
        console.log(`L${i+1} Level: ${level}`);
    }
}
console.log(`Final Level: ${level}`);
