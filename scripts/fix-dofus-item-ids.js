const fs = require('fs');

const dir = 'prisma/seed-data/dofus-quests/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('-compiled.json'));
const items = JSON.parse(fs.readFileSync(dir + 'dofus-items.json', 'utf8'));

// Slug mapping if different
const slugMap = {
    'argent-compiled.json': 'argente',
    'argent-scint-compiled.json': 'argente-scintillant',
    'glace-compiled.json': 'des-glaces',
    'veilleurs-compiled.json': 'veilleur',
    'cauchemar-compiled.json': 'du-cauchemar'
};

for (const file of files) {
    const rawSlug = file.replace('-compiled.json', '');
    const realSlug = slugMap[file] || rawSlug;
    
    const item = items.find(i => i.slug === realSlug);
    if (!item) {
        console.log(`NO item found for ${file} -> mapped as ${realSlug}`);
        continue;
    }
    
    const data = JSON.parse(fs.readFileSync(dir + file, 'utf8'));
    if (data.dofusItemId !== item.dofusDbItemId) {
        console.log(`Fixing ${file}: ${data.dofusItemId} -> ${item.dofusDbItemId}`);
        data.dofusItemId = item.dofusDbItemId;
        fs.writeFileSync(dir + file, JSON.stringify(data, null, 2));
    }
}
console.log('All files updated.');
