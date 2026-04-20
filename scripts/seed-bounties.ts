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
        const filePath = path.join(process.cwd(), 'scripts', 'bounties-duffus-parsed.json');
        if (!fs.existsSync(filePath)) {
            console.error('Parsed data not found!');
            return;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        for (const bounty of data) {
            // Clean up level if it's too high (likely a mistake in parsing)
            const cleanedLevel = bounty.level > 1000 ? 200 : bounty.level;

            await prisma.bounty.upsert({
                where: { name: bounty.name },
                update: {
                    level: cleanedLevel,
                    zoneName: bounty.zone,
                    imageUrl: bounty.img,
                    dpnlUrl: bounty.url
                },
                create: {
                    name: bounty.name,
                    level: cleanedLevel,
                    zoneName: bounty.zone,
                    imageUrl: bounty.img,
                    dpnlUrl: bounty.url
                }
            });
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
