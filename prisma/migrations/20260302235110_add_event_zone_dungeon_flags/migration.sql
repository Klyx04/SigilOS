-- AlterTable
ALTER TABLE "Dungeon" ADD COLUMN IF NOT EXISTS "isEventDungeon" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Zone" ADD COLUMN IF NOT EXISTS "eventZoneKey" TEXT,
ADD COLUMN IF NOT EXISTS "isEventZone" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dungeon_isEventDungeon_idx" ON "Dungeon"("isEventDungeon");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Zone_isEventZone_idx" ON "Zone"("isEventZone");
