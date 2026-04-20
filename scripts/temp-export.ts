import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env and .env.local
dotenv.config();
dotenv.config({ path: '.env.local' });

const user = process.env.POSTGRES_USER || 'user';
const pwd = process.env.POSTGRES_PASSWORD || 'password';
const db_name = process.env.POSTGRES_DB || 'sigilos';
const host = 'localhost';
const port = '5433';

const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;

async function exportSeeds() {
  console.log(`📊 Connecting to ${connectionString}...`);
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  console.log('📊 Fetching data from database...');
  
  try {
    const [zones, monsterFamilies, challenges, dungeons] = await Promise.all([
      prisma.zone.findMany({ orderBy: { name: 'asc' } }),
      prisma.monsterFamily.findMany({ 
        orderBy: { name: 'asc' },
        include: { zones: true }
      }),
      prisma.challenge.findMany({ orderBy: { name: 'asc' } }),
      prisma.dungeon.findMany({ 
        orderBy: { level: 'asc' },
        include: { achievements: { include: { challenge: true } } }
      })
    ]);

    const data = {
      _meta: {
        exportedAt: new Date().toISOString(),
        environment: 'local',
        version: '1.0',
        counts: {
          zones: zones.length,
          monsterFamilies: monsterFamilies.length,
          challenges: challenges.length,
          dungeons: dungeons.length
        }
      },
      zones: zones.map(z => ({ slug: z.slug, name: z.name, description: z.description })),
      monsterFamilies: monsterFamilies.map(mf => ({
        slug: mf.slug,
        name: mf.name,
        description: mf.description,
        imageUrl: mf.imageUrl,
        zoneIds: mf.zones.map(z => z.zoneId)
      })),
      challenges: challenges.map(c => ({
        slug: c.slug,
        name: c.name,
        description: c.description,
        iconUrl: c.iconUrl
      })),
      dungeons: dungeons.map(d => ({
        slug: d.slug,
        name: d.name,
        bossName: d.bossName,
        level: d.level,
        dpnlUrl: d.dpnlUrl,
        imageUrl: d.imageUrl,
        isExpedition: d.isExpedition,
        expeditionModes: d.expeditionModes,
        expeditionMechanics: d.expeditionMechanics,
        challengeSlugs: d.achievements.map(a => a.challenge.slug)
      }))
    };

    const outputDir = path.join(process.cwd(), 'prisma', 'seeds');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, 'game-data.json');
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    
    console.log('✅ Seeds exported successfully!');
    console.log('📁 File:', outputFile);
    console.log('📊 Stats:', JSON.stringify(data._meta.counts, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

exportSeeds().catch(console.error);
