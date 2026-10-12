-- CreateTable
CREATE TABLE "PlayerGuideResourceCheck" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "resourceKey" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerGuideResourceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerGuideResourceCheck_guideId_characterSlot_idx" ON "PlayerGuideResourceCheck"("guideId", "characterSlot");

-- CreateIndex
CREATE INDEX "PlayerGuideResourceCheck_profileId_idx" ON "PlayerGuideResourceCheck"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGuideResourceCheck_profileId_guideId_resourceKey_char_key" ON "PlayerGuideResourceCheck"("profileId", "guideId", "resourceKey", "characterSlot");

-- AddForeignKey
ALTER TABLE "PlayerGuideResourceCheck" ADD CONSTRAINT "PlayerGuideResourceCheck_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGuideResourceCheck" ADD CONSTRAINT "PlayerGuideResourceCheck_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "OptimizedGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
