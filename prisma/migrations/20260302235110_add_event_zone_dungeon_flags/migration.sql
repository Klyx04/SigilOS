-- AlterTable
ALTER TABLE "Dungeon" ADD COLUMN     "isEventDungeon" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "eventZoneKey" TEXT,
ADD COLUMN     "isEventZone" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Dungeon_isEventDungeon_idx" ON "Dungeon"("isEventDungeon");

-- CreateIndex
CREATE INDEX "Zone_isEventZone_idx" ON "Zone"("isEventZone");
