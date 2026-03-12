
const fs = require('fs');

const content = fs.readFileSync('a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx', 'utf8');

let openTags = 0;
let closeTags = 0;
let expressions = 0;
let closingExpressions = 0;

const tagRegex = /<([a-zA-Z0-9.-]+)([^>]*?)(\/?)>/g;
const closeTagRegex = /<\/([a-zA-Z0-9.-]+)>/g;
const expressionRegex = /\{/g;
const closingExpressionRegex = /\}/g;

let match;
while ((match = tagRegex.exec(content)) !== null) {
    if (match[3] !== '/') {
        openTags++;
    }
}

while ((match = closeTagRegex.exec(content)) !== null) {
    closeTags++;
}

while ((match = expressionRegex.exec(content)) !== null) {
    expressions++;
}

while ((match = closingExpressionRegex.exec(content)) !== null) {
    closingExpressions++;
}

console.log(`Open Tags: ${openTags}`);
console.log(`Close Tags: ${closeTags}`);
console.log(`Expressions: ${expressions}`);
console.log(`Closing Expressions: ${closingExpressions}`);
