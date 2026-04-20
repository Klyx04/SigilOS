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

async function fixZones() {
    const connectionString = getConnectionString();
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        const bounties = await prisma.bounty.findMany();
        console.log(`Fixing ${bounties.length} bounties...`);

        const subareaCache = {};

        for (const b of bounties) {
            console.log(`Fetching DofusDB details for ${b.name}...`);
            const res = await fetch(`https://api.dofusdb.fr/monsters?name.fr=${encodeURIComponent(b.name)}&lang=fr`);
            const json = await res.json();
            const monster = json.data?.[0];
            
            if (monster && monster.subareas?.length > 0) {
                const subareaId = monster.subareas[0];
                let zoneName = subareaCache[subareaId];
                
                if (!zoneName) {
                    const sRes = await fetch(`https://api.dofusdb.fr/subareas/${subareaId}?lang=fr`);
                    const sJson = await sRes.json();
                    zoneName = sJson.name?.fr || "Inconnu";
                    subareaCache[subareaId] = zoneName;
                }

                await prisma.bounty.update({
                    where: { id: b.id },
                    data: { zoneName }
                });
                console.log(`Updated ${b.name} -> ${zoneName}`);
            } else {
                console.log(`No subarea found for ${b.name}`);
            }
            await new Promise(r => setTimeout(r, 100));
        }
        console.log('Zone fix complete!');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

fixZones();
