-- AlterTable: Add characterSlot column for multi-character progress tracking
ALTER TABLE "PlayerGuideProgress" ADD COLUMN     "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL';

-- AlterIndex: Drop old unique constraint that was on (profileId, milestoneId)
DROP INDEX IF EXISTS "PlayerGuideProgress_profileId_milestoneId_key";

-- CreateIndex: New unique constraint includes characterSlot
CREATE UNIQUE INDEX "PlayerGuideProgress_profileId_milestoneId_characterSlot_key" ON "PlayerGuideProgress"("profileId", "milestoneId", "characterSlot");

-- CreateIndex: Index on characterSlot for faster filtering
CREATE INDEX "PlayerGuideProgress_characterSlot_idx" ON "PlayerGuideProgress"("characterSlot");