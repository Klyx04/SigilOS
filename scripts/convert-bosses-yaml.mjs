// Script to convert monsters.yaml to JSON
// Integrated troll filtering and new field support (Mechanic, MechanicShort)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const YAML_PATH = 'a:/SigilOS/Songes_Pour_Les_Noobs/wwwroot/Data/monsters.yaml';

if (!existsSync(YAML_PATH)) {
    console.error(`❌ File not found: ${YAML_PATH}`);
    process.exit(1);
}

const raw = readFileSync(YAML_PATH, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split('\n');

const monsters = [];
let current = null;
let currentField = null;
let multiline = '';

const NUMERIC_FIELDS = ['Difficulty', 'ImmediateFocus', 'Evasion', 'Tanking', 'Id'];

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
        if (current && current.Id < 1000000) { // Filter out troll bosses (Id >= 1,000,000)
            monsters.push(current);
        }
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
        if (NUMERIC_FIELDS.includes(key)) {
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

    // Multiline content (indented 4 spaces)
    if (currentField && (line.startsWith('    ') || line.trim() === '')) {
        multiline += line.replace(/^    /, '') + '\n';
        continue;
    }

    // Blank line between entries
    if (line.trim() === '') {
        flush();
    }
}

// Last monster
flush();
if (current && current.Id < 1000000) monsters.push(current);

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/songes-bosses.json', JSON.stringify(monsters, null, 2));

console.log(`✅ Conversion terminée : ${monsters.length} boss officiels exportés.`);
console.log(`🚀 Trolls filtrés : Crocus, Diddy, Epstein retirés.`);
