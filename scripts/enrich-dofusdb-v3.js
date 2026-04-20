const fs = require('fs');
const https = require('https');

let dofusWords = {}; // word -> category

function fetchDofusDbPage(type, skip) {
    return new Promise((resolve) => {
        let raw = '';
        https.get('https://api.dofusdb.fr/' + type + '?=50&=' + skip + '&=name.fr', (res) => {
            if (res.statusCode !== 200) { resolve(null); return; }
            res.setEncoding('utf8');
            res.on('data', (c) => raw += c);
            res.on('end', () => {
                try {
                    const data = JSON.parse(raw);
                    resolve(data);
                } catch(e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function fetchAllResources(type, categoryName) {
    let skip = 0;
    let totalItems = 0;
    
    while(true) {
        const data = await fetchDofusDbPage(type, skip);
        if (!data || !data.data || data.data.length === 0) break;
        
        const items = data.data;
        items.forEach(item => {
            if (item.name && item.name.fr) {
                // Sépare par espace, tiret, apostrophe
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
        
        totalItems += items.length;
        skip += 50;
        
        // Stop fetching eventually just in case (e.g. 50k items max per type)
        if (skip > 50000) break;
    }
    console.log('Fetched ' + categoryName + ' (endpoint ' + type + '): ' + totalItems + ' ressources réelles traitées.');
}

async function main() {
    console.log('Début du siphonage absolu de DofusDB avec pagination...');
    
    await fetchAllResources('breeds', 'Classe');
    await fetchAllResources('monsters', 'Monstre / PNJ');
    await fetchAllResources('challenges', 'Challenge');
    await fetchAllResources('quests', 'Quête');
    await fetchAllResources('items', 'Objet');
    await fetchAllResources('mounts', 'Monture');
    await fetchAllResources('pets', 'Familier');
    await fetchAllResources('resources', 'Ressource');
    await fetchAllResources('spells', 'Sort');
    await fetchAllResources('npcs', 'PNJ');

    const filePath = 'public/game-data/bomb-dictionary.json';
    const data = { 
        words: Object.keys(dofusWords), 
        categories: dofusWords,
        version: '6.0' 
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('Succès ! Dictionnaire absolu Dofus généré localement avec ' + Object.keys(dofusWords).length + ' mots uniques!');
}

main();
