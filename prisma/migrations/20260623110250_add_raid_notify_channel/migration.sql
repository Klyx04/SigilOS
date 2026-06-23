-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "raidNotifyChannelId" TEXT,
ADD COLUMN     "raidPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
