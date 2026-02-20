-- CreateEnum
CREATE TYPE "DjSearchMode" AS ENUM ('FARM', 'SUCCES', 'MIXED', 'QUETE');

-- CreateEnum
CREATE TYPE "DjSearchStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DjParticipantStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'DONJONS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FINDER_JOIN_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'FINDER_POST_FULL';
ALTER TYPE "NotificationType" ADD VALUE 'FINDER_POST_CLOSED';

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "djNotifyChannelId" TEXT;

-- CreateTable
CREATE TABLE "DjSearchPost" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dungeonId" TEXT NOT NULL,
    "mode" "DjSearchMode" NOT NULL DEFAULT 'FARM',
    "wantedAchievementIds" TEXT[],
    "maxMembers" INTEGER NOT NULL DEFAULT 4,
    "questName" TEXT,
    "questUrl" TEXT,
    "message" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "DjSearchStatus" NOT NULL DEFAULT 'OPEN',
    "discordMessageId" TEXT,
    "discordChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DjSearchPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DjSearchParticipant" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classe" TEXT,
    "message" TEXT,
    "status" "DjParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "DjSearchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDungeonProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dungeonId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDungeonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DjSearchPost_guildId_status_createdAt_idx" ON "DjSearchPost"("guildId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DjSearchPost_profileId_idx" ON "DjSearchPost"("profileId");

-- CreateIndex
CREATE INDEX "DjSearchPost_dungeonId_idx" ON "DjSearchPost"("dungeonId");

-- CreateIndex
CREATE INDEX "DjSearchPost_expiresAt_idx" ON "DjSearchPost"("expiresAt");

-- CreateIndex
CREATE INDEX "DjSearchParticipant_postId_status_idx" ON "DjSearchParticipant"("postId", "status");

-- CreateIndex
CREATE INDEX "DjSearchParticipant_profileId_idx" ON "DjSearchParticipant"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "DjSearchParticipant_postId_profileId_key" ON "DjSearchParticipant"("postId", "profileId");

-- CreateIndex
CREATE INDEX "UserDungeonProgress_profileId_idx" ON "UserDungeonProgress"("profileId");

-- CreateIndex
CREATE INDEX "UserDungeonProgress_dungeonId_idx" ON "UserDungeonProgress"("dungeonId");

-- CreateIndex
CREATE INDEX "UserDungeonProgress_achievementId_idx" ON "UserDungeonProgress"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDungeonProgress_profileId_achievementId_key" ON "UserDungeonProgress"("profileId", "achievementId");

-- AddForeignKey
ALTER TABLE "DjSearchPost" ADD CONSTRAINT "DjSearchPost_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DjSearchPost" ADD CONSTRAINT "DjSearchPost_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DjSearchPost" ADD CONSTRAINT "DjSearchPost_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DjSearchParticipant" ADD CONSTRAINT "DjSearchParticipant_postId_fkey" FOREIGN KEY ("postId") REFERENCES "DjSearchPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DjSearchParticipant" ADD CONSTRAINT "DjSearchParticipant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDungeonProgress" ADD CONSTRAINT "UserDungeonProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDungeonProgress" ADD CONSTRAINT "UserDungeonProgress_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDungeonProgress" ADD CONSTRAINT "UserDungeonProgress_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "DungeonAchievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
