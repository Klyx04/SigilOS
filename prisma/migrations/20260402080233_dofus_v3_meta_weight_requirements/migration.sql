-- AlterTable
ALTER TABLE "DofusItem" ADD COLUMN     "bonusSummary" TEXT,
ADD COLUMN     "isMeta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSylvestreReq" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DofusQuestEntry" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PlayerDofusProgress" ADD COLUMN     "completionPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DofusRequirement" (
    "id" TEXT NOT NULL,
    "fromDofusId" TEXT NOT NULL,
    "toDofusId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DofusRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DofusRequirement_fromDofusId_idx" ON "DofusRequirement"("fromDofusId");

-- CreateIndex
CREATE INDEX "DofusRequirement_toDofusId_idx" ON "DofusRequirement"("toDofusId");

-- CreateIndex
CREATE UNIQUE INDEX "DofusRequirement_fromDofusId_toDofusId_key" ON "DofusRequirement"("fromDofusId", "toDofusId");

-- CreateIndex
CREATE INDEX "DofusItem_isSylvestreReq_idx" ON "DofusItem"("isSylvestreReq");

-- AddForeignKey
ALTER TABLE "DofusRequirement" ADD CONSTRAINT "DofusRequirement_fromDofusId_fkey" FOREIGN KEY ("fromDofusId") REFERENCES "DofusItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DofusRequirement" ADD CONSTRAINT "DofusRequirement_toDofusId_fkey" FOREIGN KEY ("toDofusId") REFERENCES "DofusItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
