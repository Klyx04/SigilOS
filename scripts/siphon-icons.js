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

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'assets', 'avis', 'portraits');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function siphonIcons() {
    console.log('--- SIPHONING BOUNTY ICONS FROM DUFFUS LIST ---');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto('https://duffus.fr/avis-de-recherche', { waitUntil: 'networkidle2', timeout: 90000 });
        
        console.log('Page loaded, scrolling to load all items...');
        // Auto-scroll logic
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 100;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await new Promise(r => setTimeout(r, 5000));

        const iconsData = await page.evaluate(() => {
            // Target elements that have wr-link as a child
            const items = Array.from(document.querySelectorAll('.wr-link')).map(link => {
                const card = link.parentElement;
                const img = card.querySelector('img');
                const label = link.getAttribute('aria-label') || '';
                const name = label.replace('Ouvrir ', '').trim();
                const iconUrl = img ? img.src : null;
                return { name, iconUrl };
            });
            return items.filter(d => d.name && d.iconUrl && !d.iconUrl.includes('data:image'));
        });

        console.log(`Found ${iconsData.length} icons in list.`);

        for (const data of iconsData) {
            // Find bounty in DB
            const bounty = await prisma.bounty.findFirst({
                where: {
                    name: {
                        contains: data.name,
                        mode: 'insensitive'
                    }
                }
            });

            if (!bounty) {
                console.log(`Bounty not found in DB: ${data.name}`);
                continue;
            }

            const ext = '.png'; // Portraits are usually png
            const filename = `${bounty.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}${ext}`;
            const dest = path.join(DOWNLOAD_DIR, filename);

            console.log(`Downloading icon for ${bounty.name}...`);
            try {
                await downloadImage(data.iconUrl, dest);
                const localUrl = `/assets/avis/portraits/${filename}`;

                await prisma.bounty.update({
                    where: { id: bounty.id },
                    data: { imageUrl: localUrl }
                });
                console.log(`✅ Updated ${bounty.name}`);
            } catch (e) {
                console.error(`❌ Failed ${bounty.name}: ${e.message}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
        await pool.end();
    }
}

siphonIcons();
