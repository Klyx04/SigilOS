const fs = require('fs');

const dir = 'prisma/seed-data/dofus-quests/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let totalFixed = 0;

for (const file of files) {
    const filePath = dir + file;
    const raw = fs.readFileSync(filePath, 'utf8');
    
    // Only parse files that look like they have chains
    if (!raw.includes('"chains":')) continue;
    
    let db;
    try {
        db = JSON.parse(raw);
    } catch(e) {
        console.error(`Cannot parse ${file}`);
        continue;
    }
    
    let modified = false;
    
    if (db.chains) {
        for (const chain of db.chains) {
            if (chain.entries) {
                for (const entry of chain.entries) {
                    if (typeof entry.name === 'object' && entry.name !== null) {
                        const obj = entry.name;
                        entry.name = obj.name || "Quête inconnue";
                        if (obj.id) entry.dofusdbId = obj.id;
                        if (obj.note) entry.notes = obj.note;
                        modified = true;
                        totalFixed++;
                    }
                }
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
        console.log(`Fixed ${file}`);
    }
}

console.log(`Finished fixing. Fixed ${totalFixed} entries across all files.`);
