-- AlterTable
ALTER TABLE "DofusItem" ADD COLUMN     "localImageUrl" TEXT;

-- AlterTable
ALTER TABLE "DofusQuestChain" ADD COLUMN     "coordinatesV3" JSONB;

-- AlterTable
ALTER TABLE "DofusQuestEntry" ADD COLUMN     "coordinatesV3" JSONB,
ADD COLUMN     "localImageUrl" TEXT;
