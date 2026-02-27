-- AlterTable
ALTER TABLE "GuildModules" ADD COLUMN     "quests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resources" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "worldmap" BOOLEAN NOT NULL DEFAULT false;
