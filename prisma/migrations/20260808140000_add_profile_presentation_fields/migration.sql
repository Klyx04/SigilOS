-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "objectifs" TEXT,
ADD COLUMN IF NOT EXISTS "preferredActivities" JSONB,
ADD COLUMN IF NOT EXISTS "discordContact" TEXT;
