-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "calendarPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "djPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "songesPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
