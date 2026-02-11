/*
  Warnings:

  - You are about to drop the column `zoneId` on the `Monster` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Dungeon` table without a default value. This is not possible if the table is not empty.
  - Added the required column `familyId` to the `Monster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Monster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Zone` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Monster" DROP CONSTRAINT "Monster_zoneId_fkey";

-- DropIndex
DROP INDEX "Monster_zoneId_idx";

-- AlterTable
ALTER TABLE "Dungeon" ADD COLUMN     "expeditionMechanics" TEXT,
ADD COLUMN     "expeditionModes" JSONB,
ADD COLUMN     "isExpedition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Monster" DROP COLUMN "zoneId",
ADD COLUMN     "familyId" TEXT NOT NULL,
ADD COLUMN     "level" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "MonsterFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonsterFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "difficulty" INTEGER DEFAULT 3,
    "conditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonAchievement" (
    "id" TEXT NOT NULL,
    "dungeonId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonsterFamily_name_key" ON "MonsterFamily"("name");

-- CreateIndex
CREATE INDEX "MonsterFamily_name_idx" ON "MonsterFamily"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_name_key" ON "Challenge"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_slug_key" ON "Challenge"("slug");

-- CreateIndex
CREATE INDEX "Challenge_slug_idx" ON "Challenge"("slug");

-- CreateIndex
CREATE INDEX "Challenge_name_idx" ON "Challenge"("name");

-- CreateIndex
CREATE INDEX "DungeonAchievement_dungeonId_idx" ON "DungeonAchievement"("dungeonId");

-- CreateIndex
CREATE INDEX "DungeonAchievement_challengeId_idx" ON "DungeonAchievement"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "DungeonAchievement_dungeonId_challengeId_key" ON "DungeonAchievement"("dungeonId", "challengeId");

-- CreateIndex
CREATE INDEX "Dungeon_level_idx" ON "Dungeon"("level");

-- CreateIndex
CREATE INDEX "Dungeon_isExpedition_idx" ON "Dungeon"("isExpedition");

-- CreateIndex
CREATE INDEX "Monster_familyId_idx" ON "Monster"("familyId");

-- CreateIndex
CREATE INDEX "Monster_name_idx" ON "Monster"("name");

-- CreateIndex
CREATE INDEX "Zone_name_idx" ON "Zone"("name");

-- AddForeignKey
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "MonsterFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonAchievement" ADD CONSTRAINT "DungeonAchievement_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonAchievement" ADD CONSTRAINT "DungeonAchievement_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
