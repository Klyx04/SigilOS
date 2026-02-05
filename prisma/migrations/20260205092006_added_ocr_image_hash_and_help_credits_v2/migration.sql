/*
  Warnings:

  - A unique constraint covering the columns `[guildId,weekNumber,year,slotIndex]` on the table `Mission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AnomalieType" AS ENUM ('ZONE', 'BOSS');

-- CreateEnum
CREATE TYPE "SongesDifficulty" AS ENUM ('REVE', 'PARADOXE', 'CAUCHEMAR');

-- CreateEnum
CREATE TYPE "ExpeditionMode" AS ENUM ('BRAVOURE', 'AUDACE', 'AUCUN');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MISSION_VALIDATED', 'MISSION_REJECTED', 'NEW_SUBMISSION_PENDING', 'SYSTEM_INFO', 'SONGES_JOIN_REQUEST', 'EVENT_REMINDER');

-- CreateEnum
CREATE TYPE "DreamDifficulty" AS ENUM ('REVE_I', 'REVE_II', 'REVE_III', 'PARADOXE_I', 'PARADOXE_II', 'PARADOXE_III', 'PARADOXE_IV', 'CAUCHEMAR_I', 'CAUCHEMAR_II', 'CAUCHEMAR_III');

-- CreateEnum
CREATE TYPE "DreamObjective" AS ENUM ('MISSION_GUILDE', 'DROP_LEGENDE', 'SUCCES_NO_ACHAT', 'FUN', 'QUETE');

-- CreateEnum
CREATE TYPE "DreamRunStatus" AS ENUM ('RECRUITING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "DreamRoomType" AS ENUM ('COMBAT', 'FONTAINE', 'FAVEUR', 'BOSS', 'ENTREE');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GuildEventType" AS ENUM ('RAID_OFFICIAL', 'EVENT_GUILD', 'SESSION_MISSIONS', 'SORTIE_FARM', 'ALMANAX_BONUS', 'GUILD_MISSION', 'SONGES_RUN', 'DUNGEON_FARM', 'SOCIAL', 'OFFICIAL_RESET');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('UNIQUE', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('REGISTERED', 'RESERVE', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "AttendeeStatus" AS ENUM ('GOING', 'MAYBE', 'DECLINED');

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "absenceChannelId" TEXT,
ADD COLUMN     "calendarNotifyChannelId" TEXT,
ADD COLUMN     "dofusServerId" TEXT,
ADD COLUMN     "dofusServerName" TEXT,
ADD COLUMN     "metamobApiKey" TEXT,
ADD COLUMN     "presentationActivities" JSONB,
ADD COLUMN     "presentationBannerType" TEXT DEFAULT 'discord',
ADD COLUMN     "presentationBannerUrl" TEXT,
ADD COLUMN     "presentationCoLeaders" JSONB,
ADD COLUMN     "presentationDiscord" TEXT,
ADD COLUMN     "presentationDiscordReq" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "presentationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "presentationFoundedDate" TIMESTAMP(3),
ADD COLUMN     "presentationFounder" TEXT,
ADD COLUMN     "presentationHistory" TEXT,
ADD COLUMN     "presentationMinLevel" INTEGER,
ADD COLUMN     "presentationMinSuccesses" INTEGER,
ADD COLUMN     "presentationPhotoUrl" TEXT,
ADD COLUMN     "presentationRecruitReq" TEXT,
ADD COLUMN     "presentationRecruiting" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "presentationServer" TEXT,
ADD COLUMN     "presentationTeam" JSONB,
ADD COLUMN     "songesNotifyChannelId" TEXT;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "slotIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "ocrResult" JSONB,
ADD COLUMN     "ocrScore" DOUBLE PRECISION,
ADD COLUMN     "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "achievementLastSync" TIMESTAMP(3),
ADD COLUMN     "achievementPoints" INTEGER,
ADD COLUMN     "altPseudos" JSONB,
ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "availability" JSONB,
ADD COLUMN     "classeSecondaires" JSONB,
ADD COLUMN     "discordCacheUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "discordJoinedAt" TIMESTAMP(3),
ADD COLUMN     "discordNickname" TEXT,
ADD COLUMN     "discordRoleColor" INTEGER,
ADD COLUMN     "discordRoleName" TEXT,
ADD COLUMN     "dofusBookLinks" JSONB,
ADD COLUMN     "dofusPseudo" TEXT,
ADD COLUMN     "entraidePoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fmPriceClassic" INTEGER,
ADD COLUMN     "fmPriceExo" INTEGER,
ADD COLUMN     "fmPriceTrans" INTEGER,
ADD COLUMN     "forgemagieStatus" TEXT DEFAULT 'UNAVAILABLE',
ADD COLUMN     "guildatons" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "lastActivityDesc" TEXT,
ADD COLUMN     "lastLadderUpdate" TIMESTAMP(3),
ADD COLUMN     "metamobLastSync" TIMESTAMP(3),
ADD COLUMN     "metamobPseudo" TEXT,
ADD COLUMN     "metamobVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "successPoints" INTEGER DEFAULT 0,
ADD COLUMN     "vacationEnd" TIMESTAMP(3),
ADD COLUMN     "vacationNotify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vacationStart" TIMESTAMP(3),
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AllowedGuild" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "name" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'BETA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "AllowedGuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementSubmission" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "points" INTEGER NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "ocrScore" DOUBLE PRECISION,
    "ocrRawText" TEXT,
    "validatorId" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dungeon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bossName" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "dpnlUrl" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dungeon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "dpnlUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Monster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreamRun" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "difficulty" "DreamDifficulty" NOT NULL,
    "objective" "DreamObjective" DEFAULT 'FUN',
    "objectives" "DreamObjective"[],
    "status" "DreamRunStatus" NOT NULL DEFAULT 'RECRUITING',
    "currentFloor" INTEGER NOT NULL DEFAULT 0,
    "pointsReve" INTEGER NOT NULL DEFAULT 0,
    "minorBonuses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notifyOnJoinRequest" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DreamRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreamRunMember" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DreamRunMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreamWaitlist" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DreamWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreamFloor" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "roomType" "DreamRoomType" NOT NULL,
    "difficulty" INTEGER,
    "pointsReveGained" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DreamFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreamRunBonus" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "bonusName" TEXT NOT NULL,
    "bonusType" TEXT NOT NULL,
    "bonusRarete" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DreamRunBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreamJoinRequest" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classe" TEXT NOT NULL,
    "message" TEXT,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "DreamJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "GuildEventType" NOT NULL DEFAULT 'SOCIAL',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "recurrence" "RecurrenceType" NOT NULL DEFAULT 'UNIQUE',
    "parentEventId" TEXT,
    "location" TEXT,
    "maxParticipants" INTEGER,
    "discordMessageId" TEXT,
    "discordChannelId" TEXT,
    "metadata" JSONB,
    "notifyBefore" INTEGER DEFAULT 60,
    "lastRemindedAt" TIMESTAMP(3),
    "proofUrl" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'REGISTERED',
    "position" INTEGER NOT NULL,
    "classe" TEXT,
    "comment" TEXT,
    "promotedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageHash" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageHash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpCredit" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "missionId" TEXT,
    "message" TEXT,
    "points" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedGuild_discordGuildId_key" ON "AllowedGuild"("discordGuildId");

-- CreateIndex
CREATE INDEX "AllowedGuild_discordGuildId_idx" ON "AllowedGuild"("discordGuildId");

-- CreateIndex
CREATE INDEX "AllowedGuild_isActive_idx" ON "AllowedGuild"("isActive");

-- CreateIndex
CREATE INDEX "AuditLog_guildId_createdAt_idx" ON "AuditLog"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AchievementSubmission_guildId_status_idx" ON "AchievementSubmission"("guildId", "status");

-- CreateIndex
CREATE INDEX "AchievementSubmission_profileId_idx" ON "AchievementSubmission"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Dungeon_name_key" ON "Dungeon"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- CreateIndex
CREATE INDEX "Monster_zoneId_idx" ON "Monster"("zoneId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "DreamRun_guildId_status_idx" ON "DreamRun"("guildId", "status");

-- CreateIndex
CREATE INDEX "DreamRun_leaderId_idx" ON "DreamRun"("leaderId");

-- CreateIndex
CREATE UNIQUE INDEX "DreamRunMember_runId_userId_key" ON "DreamRunMember"("runId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DreamRunMember_runId_slot_key" ON "DreamRunMember"("runId", "slot");

-- CreateIndex
CREATE INDEX "DreamWaitlist_runId_position_idx" ON "DreamWaitlist"("runId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DreamWaitlist_runId_userId_key" ON "DreamWaitlist"("runId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DreamFloor_runId_floorNumber_key" ON "DreamFloor"("runId", "floorNumber");

-- CreateIndex
CREATE INDEX "DreamRunBonus_runId_idx" ON "DreamRunBonus"("runId");

-- CreateIndex
CREATE INDEX "DreamJoinRequest_runId_status_idx" ON "DreamJoinRequest"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DreamJoinRequest_runId_userId_key" ON "DreamJoinRequest"("runId", "userId");

-- CreateIndex
CREATE INDEX "GuildEvent_guildId_startDate_idx" ON "GuildEvent"("guildId", "startDate");

-- CreateIndex
CREATE INDEX "GuildEvent_guildId_status_idx" ON "GuildEvent"("guildId", "status");

-- CreateIndex
CREATE INDEX "GuildEvent_creatorId_idx" ON "GuildEvent"("creatorId");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_position_idx" ON "EventParticipant"("eventId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_userId_key" ON "EventParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "ImageHash_guildId_idx" ON "ImageHash"("guildId");

-- CreateIndex
CREATE INDEX "ImageHash_hash_idx" ON "ImageHash"("hash");

-- CreateIndex
CREATE INDEX "ImageHash_uploaderId_idx" ON "ImageHash"("uploaderId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageHash_guildId_hash_key" ON "ImageHash"("guildId", "hash");

-- CreateIndex
CREATE INDEX "HelpCredit_guildId_toUserId_idx" ON "HelpCredit"("guildId", "toUserId");

-- CreateIndex
CREATE INDEX "HelpCredit_guildId_fromUserId_idx" ON "HelpCredit"("guildId", "fromUserId");

-- CreateIndex
CREATE INDEX "HelpCredit_guildId_fromUserId_createdAt_idx" ON "HelpCredit"("guildId", "fromUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_guildId_weekNumber_year_slotIndex_key" ON "Mission"("guildId", "weekNumber", "year", "slotIndex");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementSubmission" ADD CONSTRAINT "AchievementSubmission_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementSubmission" ADD CONSTRAINT "AchievementSubmission_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamRunMember" ADD CONSTRAINT "DreamRunMember_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DreamRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamWaitlist" ADD CONSTRAINT "DreamWaitlist_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DreamRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamFloor" ADD CONSTRAINT "DreamFloor_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DreamRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamRunBonus" ADD CONSTRAINT "DreamRunBonus_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DreamRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamJoinRequest" ADD CONSTRAINT "DreamJoinRequest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DreamRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildEvent" ADD CONSTRAINT "GuildEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildEvent" ADD CONSTRAINT "GuildEvent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GuildEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpCredit" ADD CONSTRAINT "HelpCredit_fromUserId_guildId_fkey" FOREIGN KEY ("fromUserId", "guildId") REFERENCES "UserProfile"("userId", "guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpCredit" ADD CONSTRAINT "HelpCredit_toUserId_guildId_fkey" FOREIGN KEY ("toUserId", "guildId") REFERENCES "UserProfile"("userId", "guildId") ON DELETE CASCADE ON UPDATE CASCADE;
