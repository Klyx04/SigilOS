const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function scrapeBounties() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to Duffus...');
        await page.goto('https://duffus.fr/avis-de-recherche', { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log('Page loaded. Waiting 5s for dynamic content...');
        await new Promise(r => setTimeout(r, 5000));

        const bounties = await page.evaluate(() => {
            const items = [];
            // Find all links that contain 'avis-de-recherche' and have a slug
            const allLinks = Array.from(document.querySelectorAll('a'));
            const bountyLinks = allLinks.filter(a => {
                const href = a.getAttribute('href') || '';
                return (href.startsWith('/avis-de-recherche/') || href.includes('duffus.fr/avis-de-recherche/')) && 
                       href !== '/avis-de-recherche' && 
                       href !== 'https://duffus.fr/avis-de-recherche';
            });
            
            bountyLinks.forEach(link => {
                // Try to find Name, Level and Area
                // Based on UI observation: often cards have the name in an H3 or span
                const name = link.innerText.trim();
                const href = link.getAttribute('href');
                
                // Traverse up to find containers that might have more info
                let container = link.closest('div');
                let level = 0;
                let area = 'Inconnu';
                
                if (container) {
                    const text = container.innerText;
                    const lvlMatch = text.match(/Niv\.?\s*(\d+)/i) || text.match(/(\d+)/);
                    level = lvlMatch ? parseInt(lvlMatch[1]) : 0;
                    
                    // Specific area extraction if possible
                    const areaMatch = text.match(/Zone\s*:\s*(.+)/i);
                    area = areaMatch ? areaMatch[1].split('\n')[0].trim() : 'Inconnu';
                }

                if (name && !items.some(i => i.name === name)) {
                    items.push({
                        name,
                        level,
                        area,
                        url: href.startsWith('http') ? href : 'https://duffus.fr' + href,
                        slug: href.split('/').pop()
                    });
                }
            });
            return items;
        });

        console.log(`Found ${bounties.length} bounties.`);
        
        const outPath = path.join(__dirname, 'bounties-duffus.json');
        fs.writeFileSync(outPath, JSON.stringify(bounties, null, 2));
        console.log(`Saved to ${outPath}`);

    } catch (error) {
        console.error('Scraping failed:', error.message);
    } finally {
        await browser.close();
    }
}

scrapeBounties();
