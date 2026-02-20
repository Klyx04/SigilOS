/*
  Warnings:

  - A unique constraint covering the columns `[missionId,profileId]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Monster" DROP CONSTRAINT "Monster_familyId_fkey";

-- AlterTable
ALTER TABLE "_DungeonToZone" ADD CONSTRAINT "_DungeonToZone_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DungeonToZone_AB_unique";

-- CreateIndex
CREATE UNIQUE INDEX "Submission_missionId_profileId_key" ON "Submission"("missionId", "profileId");

-- AddForeignKey
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "MonsterFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
