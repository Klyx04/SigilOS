// Script to convert monsters.yaml to JSON
// Uses simple line-by-line parsing since the YAML is straightforward
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const raw = readFileSync('Songes_Pour_Les_Noobs/wwwroot/Data/monsters.yaml', 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split('\n');

const monsters = [];
let current = null;
let currentField = null;
let multiline = '';

function flush() {
    if (currentField && current) {
        current[currentField] = multiline.trim();
        currentField = null;
        multiline = '';
    }
}

for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');

    // New monster
    if (line.startsWith('- Id:')) {
        flush();
        if (current) monsters.push(current);
        current = { Id: parseInt(line.split(':')[1].trim()) };
        currentField = null;
        continue;
    }

    if (!current) continue;

    // Simple key: value (single line)
    const simpleMatch = line.match(/^  (\w+):\s+(.+)$/);
    if (simpleMatch && !line.endsWith('|')) {
        flush();
        const [, key, val] = simpleMatch;
        if (['Difficulty', 'ImmediateFocus', 'Evasion', 'Tanking'].includes(key)) {
            current[key] = parseInt(val);
        } else {
            current[key] = val;
        }
        continue;
    }

    // Multiline start: Key: |
    const multiMatch = line.match(/^  (\w+):\s*\|$/);
    if (multiMatch) {
        flush();
        currentField = multiMatch[1];
        multiline = '';
        continue;
    }

    // Multiline or null key: Key: (no value = null)
    const nullMatch = line.match(/^  (\w+):\s*$/);
    if (nullMatch && !currentField) {
        flush();
        current[nullMatch[1]] = null;
        continue;
    }

    // Multiline content
    if (currentField && (line.startsWith('    ') || line.trim() === '')) {
        multiline += line.replace(/^    /, '') + '\n';
        continue;
    }

    // Blank line between entries
    if (line.trim() === '') {
        flush();
    }
}
flush();
if (current) monsters.push(current);

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/songes-bosses.json', JSON.stringify(monsters, null, 2));
console.log(`✅ ${monsters.length} boss exportés vers public/data/songes-bosses.json`);
