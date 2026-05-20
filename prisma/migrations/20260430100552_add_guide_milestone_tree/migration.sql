-- CreateEnum
CREATE TYPE "GuideMilestoneType" AS ENUM ('DOFUS', 'ZONE', 'DONJON', 'QUETE_SERIE', 'ALIGNEMENT', 'PREREQUIS');

-- AlterTable
ALTER TABLE "Dungeon" ADD COLUMN     "dofusdbId" INTEGER;

-- CreateTable
CREATE TABLE "GuideMilestone" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "type" "GuideMilestoneType" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "chapter" INTEGER NOT NULL,
    "chapterLabel" TEXT NOT NULL,
    "imageUrl" TEXT,
    "accentColor" TEXT,
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "prerequisiteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideSequence" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "subGuideRef" TEXT NOT NULL,
    "subGuideName" TEXT NOT NULL,
    "stepFrom" INTEGER,
    "stepTo" INTEGER,
    "isPartial" BOOLEAN NOT NULL DEFAULT true,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "isResume" BOOLEAN NOT NULL DEFAULT false,
    "dungeonId" TEXT,
    "dungeonDbIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "questDbIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "mapPositions" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuideSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGuideProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGuideProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuideMilestone_guideId_idx" ON "GuideMilestone"("guideId");

-- CreateIndex
CREATE INDEX "GuideMilestone_guideId_chapter_order_idx" ON "GuideMilestone"("guideId", "chapter", "order");

-- CreateIndex
CREATE INDEX "GuideMilestone_type_idx" ON "GuideMilestone"("type");

-- CreateIndex
CREATE INDEX "GuideSequence_milestoneId_idx" ON "GuideSequence"("milestoneId");

-- CreateIndex
CREATE INDEX "GuideSequence_milestoneId_order_idx" ON "GuideSequence"("milestoneId", "order");

-- CreateIndex
CREATE INDEX "GuideSequence_dungeonId_idx" ON "GuideSequence"("dungeonId");

-- CreateIndex
CREATE INDEX "PlayerGuideProgress_profileId_idx" ON "PlayerGuideProgress"("profileId");

-- CreateIndex
CREATE INDEX "PlayerGuideProgress_milestoneId_idx" ON "PlayerGuideProgress"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGuideProgress_profileId_milestoneId_key" ON "PlayerGuideProgress"("profileId", "milestoneId");

-- CreateIndex
CREATE INDEX "Dungeon_dofusdbId_idx" ON "Dungeon"("dofusdbId");

-- AddForeignKey
ALTER TABLE "GuideMilestone" ADD CONSTRAINT "GuideMilestone_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "OptimizedGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideSequence" ADD CONSTRAINT "GuideSequence_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideSequence" ADD CONSTRAINT "GuideSequence_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "GuideMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGuideProgress" ADD CONSTRAINT "PlayerGuideProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGuideProgress" ADD CONSTRAINT "PlayerGuideProgress_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "GuideMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
