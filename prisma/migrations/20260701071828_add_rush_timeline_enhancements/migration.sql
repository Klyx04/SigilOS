-- AlterTable
ALTER TABLE "GuideMilestone" ADD COLUMN     "dofusId" TEXT,
ADD COLUMN     "tips" TEXT;

-- AlterTable
ALTER TABLE "GuideSequence" ADD COLUMN     "alignOrderReq" INTEGER,
ADD COLUMN     "alignReq" TEXT,
ADD COLUMN     "dofusdbUrl" TEXT,
ADD COLUMN     "dofuspourlesnoobsUrl" TEXT,
ADD COLUMN     "dungeonIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tips" TEXT;
