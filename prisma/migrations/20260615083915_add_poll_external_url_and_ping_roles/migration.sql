-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "pollsPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "externalUrl" TEXT;
