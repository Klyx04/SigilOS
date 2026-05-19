-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "guildHallPosX" INTEGER,
ADD COLUMN     "guildHallPosY" INTEGER,
ADD COLUMN     "guildHallWorldId" INTEGER DEFAULT 1;
