const fs = require('fs');
const https = require('https');

const endpoints = ['monsters', 'weapons', 'pets', 'mounts', 'classes', 'equipments', 'resources', 'consumables'];
let newWords = [];

function fetchEndpoint(endpoint) {
    return new Promise((resolve, reject) => {
        let raw = '';
        https.get('https://fr.dofus.dofapi.fr/' + endpoint, (res) => {
            res.on('data', (c) => raw += c);
            res.on('end', () => {
                try {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) {
                        arr.forEach(item => {
                            if (item.name) {
                                // Split by spaces, hyphens, etc to get individual words and full words
                                const name = item.name;
                                newWords.push(name);
                                name.split(/[\s-']+/).forEach(w => newWords.push(w));
                            }
                        });
                    }
                    console.log('Fetched ' + endpoint + ': ' + arr.length + ' items');
                    resolve();
                } catch(e) { resolve(); }
            });
        }).on('error', resolve);
    });
}

async function main() {
    console.log('Starting Dofus fetch...');
    for (const ep of endpoints) {
        await fetchEndpoint(ep);
    }
    
    // Process existing words
    const existPath = 'public/game-data/bomb-dictionary.json';
    let existWords = [];
    if (fs.existsSync(existPath)) {
        existWords = JSON.parse(fs.readFileSync(existPath)).words;
    }
    
    const allWords = [...existWords, ...newWords]
        .map(w => w.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, ''))
        .filter(w => w.length >= 3 && w.length <= 25);
        
    const unique = [...new Set(allWords)];
    const data = { words: unique, version: '2.0' };
    
    fs.writeFileSync(existPath, JSON.stringify(data, null, 2));
    console.log('Done! Dofus dictionary now has ' + unique.length + ' words (up from ' + existWords.length + ')');
}

main();
