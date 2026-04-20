const fs = require('fs');
const https = require('https');

let dofusWords = {}; // word -> category

function fetchDofusDb(type, categoryName) {
    return new Promise((resolve) => {
        let raw = '';
        // Use type for the endpoint and limit to 5000
        https.get('https://api.dofusdb.fr/' + type + '?=5000&=name.fr', (res) => {
            if (res.statusCode !== 200) { resolve(); return; }
            res.on('data', (c) => raw += c);
            res.on('end', () => {
                try {
                    const data = JSON.parse(raw);
                    const items = data.data || [];
                    items.forEach(item => {
                        if (item.name && item.name.fr) {
                            const wordsToExtract = [item.name.fr, ...item.name.fr.split(/[\s-']+/)];
                            wordsToExtract.forEach(w => {
                                const normalized = w.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
                                if (normalized.length >= 3 && normalized.length <= 25) {
                                    if (!dofusWords[normalized]) {
                                        dofusWords[normalized] = categoryName;
                                    }
                                }
                            });
                        }
                    });
                    console.log('Fetched ' + categoryName + ': ' + items.length + ' items');
                    resolve();
                } catch(e) { resolve(); }
            });
        }).on('error', resolve);
    });
}

function fetchDofusDbClasses() {
    // Hardcoded classes
    const classes = ["Iop", "Cra", "Kama", "Xelor", "Enutrof", "Sacrieur", "Ouginak", "Eliotrope", "Huppermage", "Zobal", "Steamer", "Sadida", "Feca", "Sram", "Roublard", "Ecaflip", "Pandawa", "Osamodas", "Forgelance"];
    classes.forEach(c => {
        const normalized = c.toUpperCase();
        dofusWords[normalized] = "Classe / Lore";
    });
}

async function main() {
    console.log('Starting DofusDB fetch for categories...');
    
    fetchDofusDbClasses();
    
    // We fetch various categories
    await fetchDofusDb('monsters', 'Monstre / PNJ');
    await fetchDofusDb('items', 'Équipement / Objet');
    await fetchDofusDb('mounts', 'Monture');
    await fetchDofusDb('pets', 'Familier');
    await fetchDofusDb('resources', 'Ressource');

    // We also want to keep the old ones if possible? No, fetching everything is better to have accurate categories.
    // Let's also read the existing dictionary just in case and tag them as "Lore Dofus" if not found
    const existPath = 'public/game-data/bomb-dictionary.json';
    if (fs.existsSync(existPath)) {
        const existData = JSON.parse(fs.readFileSync(existPath));
        const wordsArr = Array.isArray(existData.words) ? existData.words : [];
        wordsArr.forEach(w => {
            if (!dofusWords[w]) {
                dofusWords[w] = "Lore Dofus"; // Fallback
            }
        });
    }

    const data = { 
        words: Object.keys(dofusWords), 
        categories: dofusWords,
        version: '4.0' 
    };
    
    fs.writeFileSync(existPath, JSON.stringify(data, null, 2));
    console.log('Done! Dofus dictionary generated with ' + Object.keys(dofusWords).length + ' words carrying categories.');
}

main();
