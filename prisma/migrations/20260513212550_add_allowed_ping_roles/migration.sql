-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "allowedPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
