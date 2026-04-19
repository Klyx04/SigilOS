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
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlink(dest, () => reject(new Error(`Failed to get '${url}' (${response.statusCode})`)));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function siphonMaps() {
    console.log('--- SIPHONING BOUNTY MAPS FROM DUFFUS ---');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        const bounties = await prisma.bounty.findMany();
        
        for (const bounty of bounties) {
            // Reconstruct URL if dpnlUrl is missing, although dpnlUrl should point to Duffus now?
            // Actually dpnlUrl might point to dofuspourlesnoobs. Let's force duffus url
            const slug = bounty.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const targetUrl = `https://duffus.fr/avis-de-recherche/${slug}`;
            
            console.log(`Checking ${bounty.name} at ${targetUrl}...`);
            try {
                const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                if (!response.ok()) {
                    console.log(`❌ Page not found for ${bounty.name}`);
                    continue;
                }
                
                await new Promise(r => setTimeout(r, 2000)); // Wait for render

                const mapUrl = await page.evaluate(() => {
                    // Try to find the map image. Usually in .lancement-card or contains 'maps/avis'
                    const allImgs = Array.from(document.querySelectorAll('img')).map(img => img.src);
                    
                    // Specific Duffus logic: maps are often from supabase or contain 'maps/avis'
                    const mapImg = allImgs.find(src => src.includes('maps/avis') || src.includes('supabase'));
                    return mapImg || null;
                });

                if (mapUrl) {
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
                    console.log(`⚠️ No map found for ${bounty.name}`);
                }
            } catch(e) {
                console.log(`❌ Error navigating to ${bounty.name}: ${e.message}`);
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

siphonMaps();
