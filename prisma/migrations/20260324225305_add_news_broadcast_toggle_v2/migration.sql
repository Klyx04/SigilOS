/*
  Warnings:

  - The `geoguesserReportedMaps` column on the `PlatformConfig` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "newsBroadcastEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlatformConfig" DROP COLUMN "geoguesserReportedMaps",
ADD COLUMN     "geoguesserReportedMaps" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
