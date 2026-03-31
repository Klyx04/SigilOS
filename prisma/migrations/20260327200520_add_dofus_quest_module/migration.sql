-- CreateEnum
CREATE TYPE "DofusQuestStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "DofusItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameShort" TEXT NOT NULL,
    "element" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'MAJEUR',
    "isPrimordial" BOOLEAN NOT NULL DEFAULT false,
    "levelRecommended" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "color" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "successName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DofusItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DofusQuestChain" (
    "id" TEXT NOT NULL,
    "dofusId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "description" TEXT,
    "chainOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DofusQuestChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DofusQuestEntry" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT,
    "questType" TEXT NOT NULL DEFAULT 'QUEST',
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isLast" BOOLEAN NOT NULL DEFAULT false,
    "dofusdbId" INTEGER,
    "requirements" JSONB,
    "notes" TEXT,

    CONSTRAINT "DofusQuestEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDofusProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "dofusId" TEXT NOT NULL,
    "isObtained" BOOLEAN NOT NULL DEFAULT false,
    "obtainedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDofusProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDofusQuestProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "status" "DofusQuestStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDofusQuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DofusItem_slug_key" ON "DofusItem"("slug");

-- CreateIndex
CREATE INDEX "DofusItem_slug_idx" ON "DofusItem"("slug");

-- CreateIndex
CREATE INDEX "DofusItem_displayOrder_idx" ON "DofusItem"("displayOrder");

-- CreateIndex
CREATE INDEX "DofusQuestChain_dofusId_idx" ON "DofusQuestChain"("dofusId");

-- CreateIndex
CREATE INDEX "DofusQuestChain_dofusId_chainOrder_idx" ON "DofusQuestChain"("dofusId", "chainOrder");

-- CreateIndex
CREATE INDEX "DofusQuestEntry_chainId_idx" ON "DofusQuestEntry"("chainId");

-- CreateIndex
CREATE INDEX "DofusQuestEntry_chainId_stepOrder_idx" ON "DofusQuestEntry"("chainId", "stepOrder");

-- CreateIndex
CREATE INDEX "PlayerDofusProgress_guildId_idx" ON "PlayerDofusProgress"("guildId");

-- CreateIndex
CREATE INDEX "PlayerDofusProgress_profileId_idx" ON "PlayerDofusProgress"("profileId");

-- CreateIndex
CREATE INDEX "PlayerDofusProgress_dofusId_idx" ON "PlayerDofusProgress"("dofusId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDofusProgress_profileId_dofusId_key" ON "PlayerDofusProgress"("profileId", "dofusId");

-- CreateIndex
CREATE INDEX "PlayerDofusQuestProgress_guildId_idx" ON "PlayerDofusQuestProgress"("guildId");

-- CreateIndex
CREATE INDEX "PlayerDofusQuestProgress_profileId_idx" ON "PlayerDofusQuestProgress"("profileId");

-- CreateIndex
CREATE INDEX "PlayerDofusQuestProgress_questId_idx" ON "PlayerDofusQuestProgress"("questId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDofusQuestProgress_profileId_questId_key" ON "PlayerDofusQuestProgress"("profileId", "questId");

-- AddForeignKey
ALTER TABLE "DofusQuestChain" ADD CONSTRAINT "DofusQuestChain_dofusId_fkey" FOREIGN KEY ("dofusId") REFERENCES "DofusItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DofusQuestEntry" ADD CONSTRAINT "DofusQuestEntry_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "DofusQuestChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDofusProgress" ADD CONSTRAINT "PlayerDofusProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDofusProgress" ADD CONSTRAINT "PlayerDofusProgress_dofusId_fkey" FOREIGN KEY ("dofusId") REFERENCES "DofusItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDofusQuestProgress" ADD CONSTRAINT "PlayerDofusQuestProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDofusQuestProgress" ADD CONSTRAINT "PlayerDofusQuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "DofusQuestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
