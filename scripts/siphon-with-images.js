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

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'images', 'bounties');
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

async function siphonComplete() {
    console.log('--- REFINED GLOBAL SIPHON (Images & Rewards) ---');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        const bounties = await prisma.bounty.findMany();
        
        for (const bounty of bounties) {
            if (!bounty.dpnlUrl) continue;
            
            console.log(`Siphoning ${bounty.name}...`);
            await page.goto(bounty.dpnlUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 6000)); 

            const data = await page.evaluate(() => {
                const text = document.body.innerText;
                
                // 1. Rewards (Multiple support)
                const badges = Array.from(document.querySelectorAll('div, span')).filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && /^\d+$/.test(el.innerText.trim());
                }).map(el => parseInt(el.innerText.trim()));
                
                // 2. Milice
                const miliceMatch = text.match(/(Bonta\/Brak|Astrub|Frigost|Pandala|Amakna|Sufokia)/i);
                const milice = miliceMatch ? miliceMatch[0] : 'Inconnu';

                // 3. Mechanics
                const h = Array.from(document.querySelectorAll('div, h2, h3')).find(el => el.innerText.includes('Résumé') && el.innerText.length < 15);
                let resume = '';
                if (h) {
                    let next = h.nextElementSibling;
                    while(next && !['H2','H3'].includes(next.tagName) && !next.innerText.includes('Sorts') && !next.innerText.includes('Caract')) {
                        resume += next.innerText + '\n';
                        next = next.nextElementSibling;
                    }
                }

                // 4. Zones
                const zones = Array.from(document.querySelectorAll('div, a, span'))
                    .map(el => el.innerText.trim())
                    .filter(t => t.match(/^[A-Z][^()]+ \([^()]+\)$/))
                    .map(t => t.split('(')[0].trim());

                // 5. Images Distinctions
                // On Duffus: 
                // - The minimap is often a large image with "supabase" in src.
                // - The portrait is usually smaller or in a specific header.
                const allImgs = Array.from(document.querySelectorAll('img')).map(img => img.src);
                const mapImg = allImgs.find(src => src.includes('supabase') && src.includes('render'));
                const portraitImg = allImgs.find(src => (src.includes('dofusdb') || src.includes('ankama')) && !src.includes('render'));

                return { 
                    amount: badges.length > 0 ? badges[0] : 0, 
                    allBadges: badges,
                    milice, 
                    resume: resume.trim(), 
                    zones: [...new Set(zones)].join(', '), 
                    mapUrl: mapImg || null,
                    portraitUrl: portraitImg || null
                };
            });

            // Reward Type logic
            let type = "Aviton";
            if (data.milice.includes("Bonta") || data.milice.includes("Brak")) type = "Aliton";
            else if (data.milice.includes("Frigost")) type = "Kama de glace";
            else if (data.milice.includes("Astrub") || data.milice.includes("Amakna")) type = "Doplon";

            // Build rewards array
            const rewards = data.allBadges.map(amt => ({ type, amount: amt }));

            // Download Logic
            let localPortrait = bounty.imageUrl;
            let localMap = bounty.mapUrl;

            if (data.portraitUrl) {
                const ext = path.extname(data.portraitUrl).split('?')[0] || '.png';
                const filename = `portrait-${bounty.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}${ext}`;
                const dest = path.join(DOWNLOAD_DIR, filename);
                try {
                    await downloadImage(data.portraitUrl, dest);
                    localPortrait = `/images/bounties/${filename}`;
                } catch (e) {}
            }

            if (data.mapUrl) {
                const ext = path.extname(data.mapUrl).split('?')[0] || '.jpg';
                const filename = `map-${bounty.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}${ext}`;
                const dest = path.join(DOWNLOAD_DIR, filename);
                try {
                    await downloadImage(data.mapUrl, dest);
                    localMap = `/images/bounties/${filename}`;
                } catch (e) {}
            }

            await prisma.bounty.update({
                where: { id: bounty.id },
                data: {
                    doplons: data.amount,
                    rewardType: type,
                    rewards: rewards,
                    milice: data.milice,
                    mechanics: data.resume || 'Inconnu',
                    zoneName: data.zones || bounty.zoneName,
                    imageUrl: localPortrait,
                    mapUrl: localMap
                }
            });

            console.log(`✅ ${bounty.name}: ${rewards.length} rewards, Map: ${!!localMap}`);
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
        await pool.end();
    }
}

siphonComplete();
