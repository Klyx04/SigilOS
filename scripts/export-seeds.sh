#!/bin/bash

# Export Game Data to JSON seed file
# Usage: ./scripts/export-seeds.sh [environment]
# Example: ./scripts/export-seeds.sh local

set -e

ENVIRONMENT=${1:-local}
OUTPUT_DIR="prisma/seeds"
OUTPUT_FILE="$OUTPUT_DIR/game-data.json"

echo "🌱 Exporting Game Data seeds from $ENVIRONMENT..."

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Database connection based on environment
if [ "$ENVIRONMENT" = "local" ]; then
    DB_URL=${DATABASE_URL:-"file:./dev.db"}
elif [ "$ENVIRONMENT" = "beta" ]; then
    DB_URL=$DATABASE_URL_BETA
elif [ "$ENVIRONMENT" = "production" ]; then
    DB_URL=$DATABASE_URL
else
    echo "❌ Invalid environment. Use: local, beta, or production"
    exit 1
fi

# Export using Prisma Client (Node.js script)
node -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function exportSeeds() {
  console.log('📊 Fetching data from database...');
  
  const [zones, monsterFamilies, challenges, dungeons, bounties] = await Promise.all([
    prisma.zone.findMany({ orderBy: { name: 'asc' } }),
    prisma.monsterFamily.findMany({ 
      orderBy: { name: 'asc' },
      include: { zones: true }
    }),
    prisma.challenge.findMany({ orderBy: { name: 'asc' } }),
    prisma.dungeon.findMany({ 
      orderBy: { level: 'asc' },
      include: { achievements: { include: { challenge: true } } }
    }),
    prisma.bounty.findMany({ orderBy: { level: 'asc' } })
  ]);

  const data = {
    _meta: {
      exportedAt: new Date().toISOString(),
      environment: '$ENVIRONMENT',
      version: '1.0',
      counts: {
        zones: zones.length,
        monsterFamilies: monsterFamilies.length,
        challenges: challenges.length,
        dungeons: dungeons.length,
        bounties: bounties.length
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
    })),
    bounties: bounties.map(b => ({
        name: b.name,
        level: b.level,
        zoneName: b.zoneName,
        imageUrl: b.imageUrl,
        reward: b.reward,
        levelMin: b.levelMin,
        levelMax: b.levelMax,
        dpnlUrl: b.dpnlUrl,
        doplons: b.doplons,
        rewardType: b.rewardType,
        milice: b.milice,
        mechanics: b.mechanics,
        mapUrl: b.mapUrl,
        rewards: b.rewards
    }))
  };

  fs.writeFileSync('$OUTPUT_FILE', JSON.stringify(data, null, 2));
  console.log('✅ Seeds exported successfully!');
  console.log('📁 File:', '$OUTPUT_FILE');
  console.log('📊 Stats:', JSON.stringify(data._meta.counts, null, 2));
  
  await prisma.\$disconnect();
}

exportSeeds().catch(console.error);
"

echo ""
echo "✅ Export complete: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the exported data"
echo "  2. git add $OUTPUT_FILE"
echo "  3. git commit -m 'chore: update game data seeds'"
