
const https = require('https');

const options = {
    hostname: 'www.dofusbook.net',
    port: 443,
    path: '/api/stuffs/dofus/public/14984377',
    method: 'GET',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.dofusbook.net/fr/equipement/14984377/objets'
    }
};

const req = https.request(options, res => {
    let data = '';
    res.on('data', d => { data += d; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("Root keys:", Object.keys(json));
            // Find any array that might contain stats
            for (const key in json) {
                if (Array.isArray(json[key])) {
                    console.log(`Array found: ${key} (length: ${json[key].length})`);
                    if (json[key].length > 0) {
                        console.log(`Example item of ${key}:`, JSON.stringify(json[key][0]).substring(0, 100));
                    }
                }
            }
        } catch (e) {
            console.log("Fetch failed or returned non-JSON. Status:", res.statusCode);
            console.log("Headers:", res.headers);
        }
    });
});

req.on('error', error => { console.error(error); });
req.end();
