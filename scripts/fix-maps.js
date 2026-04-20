const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const cleanEnv = (val) => val ? val.replace(/^['"]|['"]$/g, '').trim() : '';
const getConnectionString = () => {
    if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
    return `postgresql://user:password@127.0.0.1:5433/sigilos?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'assets', 'avis', 'maps');

function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlink(dest, () => reject(new Error(`Failed to get '${url}' (${response.statusCode})`)));
                return;
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function fixMapsWithSearch() {
    console.log('--- FIXING MISSING MAPS VIA SEARCH ---');
    const missing = await prisma.bounty.findMany({ where: { mapUrl: null } });
    console.log(`Found ${missing.length} missing maps.`);
    
    if (missing.length === 0) {
        await prisma.$disconnect();
        await pool.end();
        return;
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    for (const bounty of missing) {
        console.log(`Searching for: ${bounty.name}`);
        try {
            await page.goto('https://duffus.fr/avis-de-recherche', { waitUntil: 'domcontentloaded' });
            
            // Wait for the search input to be available
            await page.waitForSelector('input[type="text"]', { timeout: 5000 });
            await page.type('input[type="text"]', bounty.name);
            await new Promise(r => setTimeout(r, 1000)); // wait for filter

            // Click the first card
            const cards = await page.$$('.card-title');
            let clicked = false;
            for (const card of cards) {
                const text = await page.evaluate(el => el.textContent, card);
                if (text.toLowerCase().includes(bounty.name.toLowerCase()) || bounty.name.toLowerCase().includes(text.toLowerCase().trim())) {
                    await card.click();
                    clicked = true;
                    break;
                }
            }

            if (!clicked && cards.length > 0) {
                await cards[0].click(); // fallback to first result
                clicked = true;
            }

            if (!clicked) {
                console.log(`❌ Could not find card for ${bounty.name}`);
                continue;
            }

            await new Promise(r => setTimeout(r, 2000)); // wait for page to load
            
            const mapUrl = await page.evaluate(() => {
                const allImgs = Array.from(document.querySelectorAll('img')).map(img => img.src);
                const mapImg = allImgs.find(src => src.includes('maps/avis') || src.includes('supabase'));
                return mapImg || null;
            });

            if (mapUrl) {
                const slug = bounty.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                const ext = '.png';
                const filename = `map-${slug}${ext}`;
                const dest = path.join(DOWNLOAD_DIR, filename);

                try {
                    await downloadImage(mapUrl, dest);
                    const localUrl = `/assets/avis/maps/${filename}`;

                    await prisma.bounty.update({
                        where: { id: bounty.id },
                        data: { mapUrl: localUrl }
                    });
                    console.log(`✅ Downloaded map for ${bounty.name}`);
                } catch (e) {
                    console.log(`❌ Failed to download map for ${bounty.name}: ${e.message}`);
                }
            } else {
                console.log(`⚠️ No map found on detail page for ${bounty.name}`);
            }

        } catch (e) {
            console.log(`❌ Error processing ${bounty.name}: ${e.message}`);
        }
    }

    await browser.close();
    await prisma.$disconnect();
    await pool.end();
}

fixMapsWithSearch();
