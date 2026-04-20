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

async function siphonAll() {
    console.log('--- REFINED MULTI-ZONE SIPHON ---');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        const bounties = await prisma.bounty.findMany();
        console.log(`Processing ${bounties.length} bounties.`);

        for (const bounty of bounties) {
            if (!bounty.dpnlUrl) continue;
            
            console.log(`Siphoning ${bounty.name}...`);
            await page.goto(bounty.dpnlUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 6000)); 

            const data = await page.evaluate(() => {
                // 1. Doplons
                const text = document.body.innerText;
                const badges = Array.from(document.querySelectorAll('div, span')).filter(el => {
                    const style = window.getComputedStyle(el);
                    const bg = style.backgroundColor;
                    const val = el.innerText.trim();
                    return bg !== 'rgba(0, 0, 0, 0)' && /^\d+$/.test(val);
                }).map(el => parseInt(el.innerText.trim()));
                
                // Usually the number badge before 'Niv.' or near top
                // Level 180 has 180 at some point. Doplons for level 180 is 18.
                // Level 20 has 20 at some point. Doplons for level 20 is 2.
                // It's the small badge.
                const doplons = badges.length > 0 ? badges[0] : 0;

                // 2. Milice
                const miliceMatch = text.match(/(Bonta\/Brak|Astrub|Frigost|Pandala|Amakna|Sufokia)/i);
                const milice = miliceMatch ? miliceMatch[0] : 'Inconnu';

                // 3. Résumé
                const h = Array.from(document.querySelectorAll('div, h2, h3')).find(el => el.innerText.includes('Résumé') && el.innerText.length < 15);
                let resume = '';
                if (h) {
                    let next = h.nextElementSibling;
                    while(next && !['H2','H3'].includes(next.tagName) && !next.innerText.includes('Sorts') && !next.innerText.includes('Caract')) {
                        resume += next.innerText + '\n';
                        next = next.nextElementSibling;
                    }
                }

                // 4. Multiple Zones
                // Pattern: "Name (Subarea)"
                const zones = Array.from(document.querySelectorAll('div, a, span'))
                    .map(el => el.innerText.trim())
                    .filter(t => t.match(/^[A-Z][^()]+ \([^()]+\)$/))
                    .map(t => t.split('(')[0].trim());

                const uniqueZones = [...new Set(zones)];

                return { doplons, milice, resume: resume.trim(), zones: uniqueZones.join(', ') };
            });

            await prisma.bounty.update({
                where: { id: bounty.id },
                data: {
                    doplons: data.doplons || 0,
                    milice: data.milice,
                    mechanics: data.resume || 'Aucune mécanique particulière',
                    zoneName: data.zones || bounty.zoneName
                }
            });

            console.log(`✅ ${bounty.name}: ${data.doplons} Dpl, Zones: ${data.zones}`);
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('--- SIPHON COMPLETE ---');
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
        await pool.end();
    }
}

siphonAll();
