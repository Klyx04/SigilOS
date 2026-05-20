-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "alignment" TEXT,
ADD COLUMN     "alignmentLevel" INTEGER DEFAULT 0,
ADD COLUMN     "alignmentOrder" TEXT;
