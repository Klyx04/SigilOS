-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "missionRanks" JSONB,
ADD COLUMN     "missionTier" INTEGER DEFAULT 3;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "rank" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "tier" SET DEFAULT 1;
