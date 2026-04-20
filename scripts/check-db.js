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

async function check() {
  const connectionString = getConnectionString();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const allCount = await prisma.bounty.count();
    console.log('Total bounties:', allCount);
    
    const sample = await prisma.bounty.findMany({ take: 5 });
    console.log('Sample data:', JSON.stringify(sample, null, 2));

    const query = "Cité d'Astrub";
    const normalized = query.toLowerCase().trim();
    
    const matches = await prisma.bounty.findMany({
      where: {
        zoneName: {
          contains: normalized,
          mode: 'insensitive'
        }
      }
    });

    console.log(`Matches for "${query}":`, matches.length);
    if (matches.length > 0) {
      console.log('Match names:', matches.map(m => m.name));
    } else {
      console.log('Trying broader search "Astrub"...');
      const broad = await prisma.bounty.findMany({
        where: { zoneName: { contains: 'Astrub', mode: 'insensitive' } }
      });
      console.log('Broad matches:', broad.length, broad.map(b => `${b.name} (${b.zoneName})` || 'SANS ZONE'));
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

check();
