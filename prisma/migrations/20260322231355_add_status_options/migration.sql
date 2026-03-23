-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "statusIsLite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statusMode" TEXT NOT NULL DEFAULT 'living';
