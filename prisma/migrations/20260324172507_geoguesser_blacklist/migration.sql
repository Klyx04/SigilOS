-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "geoguesserBlacklist" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "geoguesserReportedMaps" JSONB NOT NULL DEFAULT '[]';
