import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Clean helper for environment variables
const cleanEnv = (val: string | undefined) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

// URL construction logic
const getConnectionString = () => {
    if (process.env.DATABASE_URL) {
        return cleanEnv(process.env.DATABASE_URL);
    }
    const user = cleanEnv(process.env.POSTGRES_USER) || 'sigiluser';
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || 'localhost';
    const protocol = 'postgresql';
    return `${protocol}://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5432/${db_name}?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedBounties() {
    console.log('--- Seeding Bounties from Duffus Parsed Data ---');
    try {
        let filePath = path.join(process.cwd(), 'scripts', 'bounties-duffus-parsed.json');
        if (!fs.existsSync(filePath)) {
            console.log('Duffus parsed data not found, checking for bounties.json...');
            filePath = path.join(process.cwd(), 'scripts', 'bounties.json');
            if (!fs.existsSync(filePath)) {
                console.error('No bounty seed file found!');
                return;
            }
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`Found ${data.length} bounties in seed file.`);
        
        for (const bounty of data) {
            // Clean up level if it's too high (likely a mistake in parsing)
            const cleanedLevel = (bounty.level || 0) > 1000 ? 200 : (bounty.level || 0);
            const imageUrl = bounty.img || bounty.imageUrl || null;
            const zoneName = bounty.zone || bounty.zoneName || 'Inconnu';
            const dpnlUrl = bounty.url || bounty.dpnlUrl || null;

            // `Bounty.name` n'est plus unique (avis homonymes « Ronce ») ⇒ findFirst + update/create.
            const existing = await prisma.bounty.findFirst({ where: { name: bounty.name } });
            const payload = {
                level: cleanedLevel,
                zoneName: zoneName,
                imageUrl: imageUrl,
                dpnlUrl: dpnlUrl
            };
            if (existing) {
                await prisma.bounty.update({ where: { id: existing.id }, data: payload });
            } else {
                await prisma.bounty.create({ data: { name: bounty.name, ...payload } });
            }
        }

        console.log(`Successfully seeded ${data.length} bounties.`);
    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

seedBounties();
