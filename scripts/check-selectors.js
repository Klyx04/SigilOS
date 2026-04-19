const puppeteer = require('puppeteer');

async function checkSelectors(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 6000));

        const result = await page.evaluate(() => {
            const h1 = document.querySelector('h1')?.innerText;
            
            // Doplons: It's a badge that contains a number and is NOT the level.
            // Level is usually in a "Caractéristiques" section or near top.
            // Doplons button/badge often has a coin icon.
            const badges = Array.from(document.querySelectorAll('div, span')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && /^\d+$/.test(el.innerText.trim());
            });
            
            // Sam Sagaz: AE > 0, Bonta/Brak (Alignment), 2 (Doplons), Prairies d'Astrub (Zone)
            // The number '2' is likely what we want.
            
            // Résumé
            const resumeHeader = Array.from(document.querySelectorAll('div')).find(el => el.innerText.trim() === 'Résumé');
            let mechanics = '';
            if (resumeHeader) {
                // Take everything until next div that looks like a header or sorts
                let next = resumeHeader.nextElementSibling;
                while (next && !next.innerText.includes('Sorts') && !next.innerText.includes('Caractéristiques')) {
                    mechanics += next.innerText + '\n';
                    next = next.nextElementSibling;
                }
            }

            return { h1, badges: badges.map(b => b.innerText), mechanics: mechanics.trim() };
        });
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await browser.close();
    }
}

checkSelectors('https://duffus.fr/avis-de-recherche/sam-sagaz');
