const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const cleanEnv = (val) => val ? val.replace(/^['"]|['"]$/g, '').trim() : '';
const getConnectionString = () => {
    if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
    const user = cleanEnv(process.env.POSTGRES_USER) || 'user';
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || '127.0.0.1';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5433/${db_name}?schema=public`;
};

async function syncWithDofusDB() {
    const connectionString = getConnectionString();
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log('Fetching all bounties from DofusDB...');
        const res = await fetch('https://api.dofusdb.fr/monsters?typeId=23&$limit=150&lang=fr');
        const json = await res.json();
        const monsters = json.data || [];
        console.log(`Found ${monsters.length} monsters on DofusDB.`);

        for (const m of monsters) {
            const name = m.name.fr;
            const zone = m.subareas?.[0]?.name?.fr || "Inconnu";
            const level = m.grades?.[0]?.level || 0;
            const img = m.img || `https://static.ankama.com/dofus/www/game/monsters/${m.id}.png`;

            // Update our local bounty
            await prisma.bounty.upsert({
                where: { name },
                update: {
                    zoneName: zone,
                    level: level,
                    imageUrl: img
                },
                create: {
                    name,
                    zoneName: zone,
                    level: level,
                    imageUrl: img,
                    doplons: 0,
                    milice: 'Inconnu',
                    mechanics: 'Aucune mécanique particulière'
                }
            });
            console.log(`Synced ${name} -> ${zone}`);
        }
        console.log('Sync complete!');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

syncWithDofusDB();
