# Game Data Seed System

## Overview
This directory contains the Git-based game data seeding system for SigilOS. Game data (Zones, Families, Challenges, Dungeons) is version-controlled in `game-data.json` and automatically seeded during deployment.

## Files
- **`game-data.json`** - Source of truth for all game data (committed to Git)
- **`seed.ts`** - Production-grade seed script with transaction safety

## Workflow

### 1. Local Development
1. Navigate to `/god/game-data` in your browser
2. Create/modify game data using the UI
3. Click **"🌱 Export vers Git"** button
4. The file `prisma/seed-data/game-data.json` is updated automatically

### 2. Git Workflow
```bash
# Check what changed
git diff prisma/seed-data/game-data.json

# Commit your changes
git add prisma/seed-data/game-data.json
git add public/game-data/  # If you added images
git commit -m "feat: ajout donjon Émeraude"
git push origin dev
```

### 3. Deployment
```bash
# Beta deployment (automatic seeding)
./scripts/deploy.sh beta

# Production deployment (automatic seeding)
./scripts/deploy.sh prod
```

The deploy script automatically runs `npm run seed:game-data` after migrations.

## Manual Seeding

If you need to manually seed (e.g., after a database reset):

```bash
npm run seed:game-data
```

## Adding New Data Types

### Example: Adding "Quest" data

1. **Update Prisma Schema**:
```prisma
model Quest {
  id          String @id @default(cuid())
  name        String @unique  // ← Natural key for upsert
  description String?
  level       Int
  ...
}
```

2. **Update Export Action** (`src/server/actions/game-data-admin-actions.ts`):
```typescript
export async function exportGameDataToGit() {
  // ...
  const quests = await db.quest.findMany();
  
  const exportData = {
    data: { 
      zones,
      families,
      challenges,
      dungeons,
      quests  // ← Add here
    }
  };
}
```

3. **Update Seed Script** (`prisma/seed-data/seed.ts`):
```typescript
// === QUESTS ===
if (seedData.data.quests && Array.isArray(seedData.data.quests)) {
    console.log(`\n🎯 [QUESTS] Processing ${seedData.data.quests.length} quests...`);
    
    for (const quest of seedData.data.quests) {
        if (!quest.name) continue;

        await tx.quest.upsert({
            where: { name: quest.name },
            update: { ...quest },
            create: { ...quest }
        });
    }
}
```

That's IT! 🎯

## Safety Features

✅ **Transaction-based** - All-or-nothing seeding (rollback on error)  
✅ **Idempotent** - Safe to run multiple times (upsert strategy)  
✅ **Stable IDs** - Natural key-based upserts preserve foreign key relationships  
✅ **Zero data loss** - User data (profiles, missions) never touched  
✅ **Detailed logging** - Track every operation  

## Security

- **`exportGameDataToGit()`** only works in `NODE_ENV=development`
- **`importGameData()`** requires super-admin privileges
- **File writes** restricted to seed directory only

## Troubleshooting

### Seed fails with "Invalid seed file format"
Check that `game-data.json` has valid JSON with `version` and `data` fields.

### IDs are changing on every seed
Make sure you're using natural keys (`name`, `slug`) in upsert `where` clauses, not auto-generated IDs.

### User missions broken after seed
You likely renamed a dungeon. Perform a manual migration:
```sql
UPDATE "Mission" SET "dungeonName" = 'New Name' WHERE "dungeonName" = 'Old Name';
```

---

**Last Updated**: 2026-02-12  
**Version**: 2.0
