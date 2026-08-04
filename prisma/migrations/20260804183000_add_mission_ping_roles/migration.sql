-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "missionPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];