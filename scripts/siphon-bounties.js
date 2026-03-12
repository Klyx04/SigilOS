const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function siphonBounties() {
    console.log('--- Start Hybrid Siphoning (DPLN Names + DofusDB Meta) ---');
    try {
        const response = await axios.get('https://www.dofuspourlesnoobs.com/avis-de-recherche.html');
        const $ = cheerio.load(response.data);
        
        const bountyNames = new Set();
        
        $('a').each((i, el) => {
            let name = $(el).text().trim();
            const href = $(el).attr('href');
            
            if (href && (href.includes('on-recherche') || href.includes('recherche-')) && name) {
                name = name.replace(/^[\d\s]+/, '').trim();
                if (name && isNaN(name) && name.length > 3) {
                    bountyNames.add(name);
                }
            }
        });

        console.log(`Found ${bountyNames.size} unique bounty names on DPLN.`);

        // Fetch ALL bounties (typeId=23) from DofusDB
        console.log('Fetching all bounties from DofusDB...');
        const dbResponse = await axios.get(`https://api.dofusdb.fr/monsters?typeId=23&$limit=200&lang=fr`);
        const allDbBounties = dbResponse.data.data || [];
        console.log(`Retrieved ${allDbBounties.length} bounties from DofusDB.`);

        const finalData = [];

        for (const name of bountyNames) {
            try {
                // Find match in allDbBounties
                const dbData = allDbBounties.find(b => 
                    b.name.fr.toLowerCase() === name.toLowerCase() ||
                    b.name.fr.toLowerCase().includes(name.toLowerCase()) ||
                    name.toLowerCase().includes(b.name.fr.toLowerCase())
                );

                if (dbData) {
                    finalData.push({
                        id: dbData.id,
                        name: dbData.name.fr,
                        level: dbData.grades?.[0]?.level || 0,
                        zoneName: dbData.subareas?.[0]?.name?.fr || dbData.areas?.[0]?.name?.fr || 'Inconnu',
                        imageUrl: dbData.img || `https://static.ankama.com/dofus/www/game/monsters/${dbData.id}.png`,
                        dpnlUrl: `https://www.dofuspourlesnoobs.com/on-recherche-${name.toLowerCase().replace(/['\s]/g, '-')}.html`
                    });
                } else {
                    finalData.push({ name, level: 0, zoneName: 'Inconnu', imageUrl: null });
                }
            } catch (err) {
                console.error(`Error processing ${name}:`, err.message);
            }
        }

        const outPath = path.join(__dirname, 'bounties.json');
        fs.writeFileSync(outPath, JSON.stringify(finalData, null, 2));
        console.log(`--- Siphoning Complete. Saved to ${outPath} ---`);
    } catch (error) {
        console.error('Siphoning failed:', error);
    }
}

siphonBounties();
