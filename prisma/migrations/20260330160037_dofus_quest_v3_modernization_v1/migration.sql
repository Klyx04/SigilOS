-- AlterTable
ALTER TABLE "DofusItem" ADD COLUMN     "filterCategory" TEXT NOT NULL DEFAULT 'AUTRES',
ADD COLUMN     "filterSubCategory" TEXT;

-- AlterTable
ALTER TABLE "DofusQuestEntry" ADD COLUMN     "isSynergyCandidate" BOOLEAN NOT NULL DEFAULT false;
