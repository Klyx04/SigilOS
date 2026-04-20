const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

function parseDuffusHtml() {
    const htmlPath = path.join(process.cwd(), 'duffus_bounties.html');
    if (!fs.existsSync(htmlPath)) {
        console.error('File not found:', htmlPath);
        return;
    }

    const html = fs.readFileSync(htmlPath, 'utf8');
    const $ = cheerio.load(html);
    
    const bounties = [];
    
    // Using the discovered classes
    $('.wr-card').each((i, el) => {
        const card = $(el);
        const name = card.find('.wr-title, .font-bold, h3').first().text().trim();
        const area = card.find('.wr-subtitle, .text-zinc-500, span').last().text().trim();
        
        // Find level in text
        const text = card.text();
        const lvlMatch = text.match(/Niv\.?\s*(\d+)/i) || text.match(/(\d+)/);
        const level = lvlMatch ? parseInt(lvlMatch[1]) : 0;
        
        const img = card.find('img').attr('src');
        const link = card.find('a').attr('href') || card.attr('href');

        if (name && !bounties.some(b => b.name === name)) {
            bounties.push({
                name,
                level: level > 1000 ? 0 : level, // Safety filter
                zone: area || 'Inconnu',
                img: img ? (img.startsWith('http') ? img : 'https://duffus.fr' + img) : null,
                url: link ? (link.startsWith('http') ? link : 'https://duffus.fr' + link) : `https://duffus.fr/avis-de-recherche/${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['\s]/g, '-')}`
            });
        }
    });

    console.log(`Parsed ${bounties.length} bounties with wr-card selector.`);
    
    // Fallback if none found
    if (bounties.length === 0) {
        console.log('Trying fallback selectors...');
        // ... (existing logic)
    }

    bounties.sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync('scripts/bounties-duffus-parsed.json', JSON.stringify(bounties, null, 2));
    console.log('Saved to scripts/bounties-duffus-parsed.json');
}

parseDuffusHtml();
