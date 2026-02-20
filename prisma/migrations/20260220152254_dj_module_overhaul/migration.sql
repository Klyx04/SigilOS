-- AlterEnum: Handle conversion of old values (FARM, SUCCES, MIXED) to new values (DONJON, QUETE)
-- Strategy: cast through text to bypass enum type constraints

BEGIN;

-- 1. Create new enum type
CREATE TYPE "DjSearchMode_new" AS ENUM ('DONJON', 'QUETE');

-- 2. Drop default so we can alter the column type
ALTER TABLE "public"."DjSearchPost" ALTER COLUMN "mode" DROP DEFAULT;

-- 3. Convert column: map old values to new ones via CASE expression through text
ALTER TABLE "DjSearchPost" ALTER COLUMN "mode" TYPE "DjSearchMode_new" 
  USING (
    CASE "mode"::text
      WHEN 'FARM' THEN 'DONJON'
      WHEN 'SUCCES' THEN 'DONJON'
      WHEN 'MIXED' THEN 'DONJON'
      WHEN 'DONJON' THEN 'DONJON'
      WHEN 'QUETE' THEN 'QUETE'
      ELSE 'DONJON'
    END
  )::"DjSearchMode_new";

-- 4. Rename types
ALTER TYPE "DjSearchMode" RENAME TO "DjSearchMode_old";
ALTER TYPE "DjSearchMode_new" RENAME TO "DjSearchMode";
DROP TYPE "public"."DjSearchMode_old";

-- 5. Set new default
ALTER TABLE "DjSearchPost" ALTER COLUMN "mode" SET DEFAULT 'DONJON';

COMMIT;

-- AlterTable: Add new columns
ALTER TABLE "DjSearchPost" ADD COLUMN IF NOT EXISTS "isDiscordPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DjSearchPost" ADD COLUMN IF NOT EXISTS "questId" INTEGER;
ALTER TABLE "DjSearchPost" ADD COLUMN IF NOT EXISTS "requiredClasses" TEXT[];

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserDungeonAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dungeonAchievementId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDungeonAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserDungeonAchievement_userId_idx" ON "UserDungeonAchievement"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserDungeonAchievement_dungeonAchievementId_idx" ON "UserDungeonAchievement"("dungeonAchievementId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserDungeonAchievement_userId_dungeonAchievementId_key" ON "UserDungeonAchievement"("userId", "dungeonAchievementId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserDungeonAchievement_userId_fkey') THEN
        ALTER TABLE "UserDungeonAchievement" ADD CONSTRAINT "UserDungeonAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserDungeonAchievement_dungeonAchievementId_fkey') THEN
        ALTER TABLE "UserDungeonAchievement" ADD CONSTRAINT "UserDungeonAchievement_dungeonAchievementId_fkey" FOREIGN KEY ("dungeonAchievementId") REFERENCES "DungeonAchievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
