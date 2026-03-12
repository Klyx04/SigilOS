
const fs = require('fs');
const content = fs.readFileSync('a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx', 'utf8');

const stack = [];
const lines = content.split('\n');
const tagRegex = /<([a-zA-Z0-9.-]+)([^>]*?)(\/?)>|<\/([a-zA-Z0-9.-]+)>/g;

let match;
while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const tagName = match[1] || match[4];
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = match[3] === '/';

    const lineNum = content.substring(0, match.index).split('\n').length;

    if (isClosing) {
        if (stack.length > 0 && stack[stack.length - 1].name === tagName) {
            stack.pop();
        } else {
            console.log(`L${lineNum}: Unmatched closing tag </${tagName}>`);
        }
    } else if (!isSelfClosing) {
        if (!['img', 'br', 'hr', 'input'].includes(tagName.toLowerCase())) {
            stack.push({ name: tagName, line: lineNum });
        }
    }
}

console.log("Unclosed tags stack:");
stack.forEach(t => console.log(`L${t.line}: <${t.name}>`));
