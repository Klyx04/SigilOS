
const fs = require('fs');
const content = fs.readFileSync('a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx', 'utf8');

const stack = [];
const tagRegex = /<([a-zA-Z0-9.-]+)([^>]*?)(\/?)>|<\/([a-zA-Z0-9.-]+)>/g;

let match;
while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const tagName = match[1] || match[4];
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = match[3] === '/';

    if (isClosing) {
        if (stack.length > 0 && stack[stack.length - 1].name === tagName) {
            stack.pop();
        } else {
            console.log(`Unmatched closing tag </${tagName}> at index ${match.index}`);
        }
    } else if (!isSelfClosing) {
        // Skip some common non-closing tags if any, but in React most should close
        if (!['img', 'br', 'hr', 'input'].includes(tagName.toLowerCase())) {
            stack.push({ name: tagName, index: match.index });
        }
    }
}

console.log("Remaining stack tags (unclosed):");
stack.slice(-30).forEach(t => {
    const snippet = content.substring(t.index, t.index + 40).replace(/\n/g, ' ');
    console.log(`Tag <${t.name}> at index ${t.index}: ${snippet}...`);
});
