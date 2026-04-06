/*
  Warnings:

  - A unique constraint covering the columns `[profileId,dofusId,characterName]` on the table `PlayerDofusProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[profileId,questId,characterName]` on the table `PlayerDofusQuestProgress` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PlayerDofusProgress_profileId_dofusId_key";

-- DropIndex
DROP INDEX "PlayerDofusQuestProgress_profileId_questId_key";

-- AlterTable
ALTER TABLE "PlayerDofusProgress" ADD COLUMN     "characterName" TEXT NOT NULL DEFAULT 'PRINCIPAL';

-- AlterTable
ALTER TABLE "PlayerDofusQuestProgress" ADD COLUMN     "characterName" TEXT NOT NULL DEFAULT 'PRINCIPAL';

-- CreateIndex
CREATE INDEX "PlayerDofusProgress_characterName_idx" ON "PlayerDofusProgress"("characterName");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDofusProgress_profileId_dofusId_characterName_key" ON "PlayerDofusProgress"("profileId", "dofusId", "characterName");

-- CreateIndex
CREATE INDEX "PlayerDofusQuestProgress_characterName_idx" ON "PlayerDofusQuestProgress"("characterName");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDofusQuestProgress_profileId_questId_characterName_key" ON "PlayerDofusQuestProgress"("profileId", "questId", "characterName");
