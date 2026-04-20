const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const cleanEnv = (val) => val ? val.replace(/^['"]|['"]$/g, '').trim() : '';
const getConnectionString = () => {
    if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
    const user = cleanEnv(process.env.POSTGRES_USER) || 'user';
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const host = process.env.DB_HOST || '127.0.0.1';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5433/sigilos?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function scrapeDeepBountyDetails() {
    console.log('--- Robust Slow Deep Scraping ---');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Use a very standard UA
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        const bounties = await prisma.bounty.findMany({
            where: { OR: [{ doplons: 0 }, { doplons: null }] }
        });
        console.log(`Processing ${bounties.length} bounties.`);

        for (const bounty of bounties) {
            if (!bounty.dpnlUrl) continue;
            
            let retry = 0;
            let success = false;
            
            while (retry < 2 && !success) {
                try {
                    console.log(`Scraping ${bounty.name} (Attempt ${retry + 1})...`);
                    await page.goto(bounty.dpnlUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await new Promise(r => setTimeout(r, 6000)); // Solid wait for Cloudflare

                    const data = await page.evaluate(() => {
                        const text = document.body.innerText;
                        
                        // 1. Doplons (Number badge near header)
                        const badges = Array.from(document.querySelectorAll('span, div')).map(el => el.innerText.trim());
                        const doplonValue = badges.find(b => b.match(/^\d+$/) && b.length <= 3 && b !== '0');
                        const doplons = doplonValue ? parseInt(doplonValue) : 0;

                        // 2. Milice / Alignment
                        const miliceMatch = text.match(/(Bonta\/Brak|Astrub|Frigost|Pandala|Amakna|Sufokia)/i);
                        const milice = miliceMatch ? miliceMatch[0] : 'Inconnu';

                        // 3. Resume
                        let resume = '';
                        const h2s = Array.from(document.querySelectorAll('h2'));
                        const resumeH2 = h2s.find(h => h.innerText.includes('R\u00e9sum\u00e9'));
                        if (resumeH2) {
                            let next = resumeH2.nextElementSibling;
                            while (next && !['H2', 'H3'].includes(next.tagName)) {
                                resume += next.innerText + '\n';
                                next = next.nextElementSibling;
                            }
                        }

                        return { doplons, milice, resume: resume.trim() };
                    });

                    if (data.doplons || data.resume) {
                        await prisma.bounty.update({
                            where: { id: bounty.id },
                            data: {
                                doplons: data.doplons || 0,
                                milice: data.milice,
                                mechanics: data.resume || 'Aucune mécanique particulière'
                            }
                        });
                        console.log(`✅ Success for ${bounty.name}: ${data.doplons} Doplons`);
                        success = true;
                    } else {
                        console.log(`⚠️ Partial/No data for ${bounty.name}, retrying...`);
                        retry++;
                    }
                } catch (err) {
                    console.error(`❌ Error for ${bounty.name}:`, err.message);
                    retry++;
                }
            }
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log('Enrichment complete!');
    } catch (error) {
        console.error('Critical Error:', error);
    } finally {
        await browser.close();
        await prisma.$disconnect();
        await pool.end();
    }
}

scrapeDeepBountyDetails();
