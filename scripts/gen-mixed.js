const fs = require('fs');
const https = require('https');

https.get('https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json', (res) => {
    let raw = '';
    res.on('data', (c) => raw += c);
    res.on('end', () => {
        try {
            const arr = JSON.parse(raw);
            const words = arr
                .map(w => w.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, ''))
                .filter(w => w.length >= 3 && w.length <= 25);
            
            const unique = [...new Set(words.filter(w => w))];
            const data = { words: unique, version: '1.0' };
            fs.writeFileSync('public/game-data/bomb-dictionary-mixed.json', JSON.stringify(data));
            console.log('Mixed FR dictionary generated with ' + unique.length + ' words!');
        } catch(e) {
            console.error(e);
        }
    });
});
