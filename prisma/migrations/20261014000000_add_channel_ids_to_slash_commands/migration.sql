-- AlterTable
ALTER TABLE "GuildSlashCommandPermission" ADD COLUMN "channelIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
