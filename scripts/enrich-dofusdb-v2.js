const fs = require('fs');
const https = require('https');

let dofusWords = {}; // word -> category

function fetchDofusDb(type, categoryName) {
    return new Promise((resolve) => {
        let raw = '';
        https.get('https://api.dofusdb.fr/' + type + '?=5000&=name.fr', (res) => {
            if (res.statusCode !== 200) { resolve(); return; }
            res.on('data', (c) => raw += c);
            res.on('end', () => {
                try {
                    const data = JSON.parse(raw);
                    const items = data.data || [];
                    items.forEach(item => {
                        if (item.name && item.name.fr) {
                            // On extrait la phrase entière, ainsi que chaque mot individuellement
                            const wordsToExtract = [item.name.fr, ...item.name.fr.split(/[\s-':]+/ )];
                            wordsToExtract.forEach(w => {
                                // Nettoyage absolu : retrait des accents, passage en majuscules, et on ne garde que A-Z
                                const normalized = w.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
                                // Mot entre 3 et 25 lettres seulement
                                if (normalized.length >= 3 && normalized.length <= 25) {
                                    if (!dofusWords[normalized]) {
                                        dofusWords[normalized] = categoryName;
                                    }
                                }
                            });
                        }
                    });
                    console.log('Fetched ' + categoryName + ' (endpoint ' + type + '): ' + items.length + ' entrées traitées.');
                    resolve();
                } catch(e) { resolve(); }
            });
        }).on('error', resolve);
    });
}

async function main() {
    console.log('Début de l\'extraction de masse DofusDB...');
    
    await fetchDofusDb('breeds', 'Classe');
    await fetchDofusDb('monsters', 'Monstre / PNJ');
    await fetchDofusDb('challenges', 'Challenge');
    await fetchDofusDb('quests', 'Quête');
    await fetchDofusDb('items', 'Objet');
    await fetchDofusDb('mounts', 'Monture');
    await fetchDofusDb('pets', 'Familier');
    await fetchDofusDb('resources', 'Ressource');
    await fetchDofusDb('spells', 'Sort');
    await fetchDofusDb('npcs', 'PNJ');

    const filePath = 'public/game-data/bomb-dictionary.json';
    const data = { 
        words: Object.keys(dofusWords), 
        categories: dofusWords,
        version: '5.0' 
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('Succès ! Dictionnaire absolu Dofus généré localement avec ' + Object.keys(dofusWords).length + ' mots/phrases.');
}

main();
