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

async function check() {
  const connectionString = getConnectionString();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const f = await prisma.bounty.findFirst({ where: { name: { contains: 'Frakacia' } } });
    console.log('FRAKACIA:', JSON.stringify(f, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

check();
