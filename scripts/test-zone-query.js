const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function check() {
  const pool = new Pool({ connectionString: 'postgresql://user:password@127.0.0.1:5433/sigilos?schema=public' });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const res = await prisma.bounty.findMany({ 
        where: { zoneName: { contains: 'forêt enneigée', mode: 'insensitive' } } 
    });
    console.log('Match with Forêt enneigée:', res.length);
    
    // Test base zone approach just to see
    const res2 = await prisma.bounty.findMany({ 
        where: { zoneName: { contains: 'enneig', mode: 'insensitive' } } 
    });
    console.log('Match partial:', res2.map(r => r.name));

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

check();
