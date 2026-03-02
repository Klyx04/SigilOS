/*
  Warnings:

  - A unique constraint covering the columns `[name,bossName]` on the table `Dungeon` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Dungeon_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Dungeon_name_bossName_key" ON "Dungeon"("name", "bossName");
