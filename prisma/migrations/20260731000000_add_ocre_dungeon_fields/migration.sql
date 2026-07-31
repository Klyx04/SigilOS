-- AlterTable: Add Ocre quest flag and worldmap mapId to Dungeon
ALTER TABLE "Dungeon" ADD COLUMN     "isOcreQuest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mapId" INTEGER;