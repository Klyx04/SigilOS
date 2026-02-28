
const https = require('https');

const options = {
    hostname: 'www.dofusbook.net',
    port: 443,
    path: '/api/stuffs/dofus/public/14984377',
    method: 'GET',
    headers: {
        'User-Agent': 'SigilOS-Bot/1.0',
        'Referer': 'https://www.dofusbook.net/'
    }
};

const req = https.request(options, res => {
    let data = '';
    res.on('data', d => { data += d; });
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log("Structure stuffStats:", typeof json.stuffStats);
        console.log("IsArray:", Array.isArray(json.stuffStats));
        if (json.stuffStats) {
            console.log("Keys (first 5):", Object.keys(json.stuffStats).slice(0, 5));
        }
        // Looking for totals
        if (json.stats) {
            console.log("Stats found:", Object.keys(json.stats));
        }
        console.log("Keys of JSON:", Object.keys(json));
    });
});

req.on('error', error => { console.error(error); });
req.end();
