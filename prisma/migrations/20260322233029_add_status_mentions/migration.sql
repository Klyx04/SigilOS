-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "statusFrequency" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "statusMention" TEXT NOT NULL DEFAULT 'none';
