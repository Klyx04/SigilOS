const puppeteer = require('puppeteer');
const fs = require('fs');

async function siphonBounty(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
        console.log(`Siphoning ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 7000)); // Solid wait for Cloudflare

        const data = await page.evaluate(() => {
            // 1. Title
            const name = document.querySelector('h1')?.innerText.trim();
            
            // 2. Badges (Milice, Doplons, AE)
            // On Duffus, labels are often in small badges
            const badges = Array.from(document.querySelectorAll('span, div')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && el.innerText.length > 0;
            }).map(el => el.innerText.trim());
            
            // Doplons is usually the number badge
            // Milice is Bonta/Brak or Astrub etc.
            const milice = badges.find(b => /(Bonta|Brak|Astrub|Frigost|Pandala|Sufokia|Amakna)/i.test(b)) || 'Inconnu';
            
            // Doplons (coins)
            // Let's look for the one that is just a number and NOT 'AE > X'
            const doplons = badges.find(b => /^\d+$/.test(b)) || 0;

            // 3. Résumé
            const resumeEl = Array.from(document.querySelectorAll('div, section')).find(el => el.innerText.startsWith('Résumé'));
            let mechanics = '';
            if (resumeEl) {
                mechanics = resumeEl.innerText.replace('Résumé', '').trim();
            }

            // 4. Zones (Green boxes)
            const zones = Array.from(document.querySelectorAll('div')).filter(el => {
                const style = window.getComputedStyle(el);
                return (style.backgroundColor.includes('rgba(34, 197, 94') || style.borderColor.includes('rgb(34, 197, 94')) && el.innerText.includes('(');
            }).map(el => el.innerText.split('(')[0].trim());

            return { name, milice, doplons, mechanics, zones };
        });

        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

siphonBounty('https://duffus.fr/avis-de-recherche/sam-sagaz');
