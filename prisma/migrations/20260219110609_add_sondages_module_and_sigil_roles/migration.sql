-- CreateEnum
CREATE TYPE "PollCategory" AS ENUM ('SUGGESTION', 'AMELIORATION', 'EVENT', 'MISSION', 'AUTRE');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "pollsNotifyChannelId" TEXT,
ADD COLUMN     "pollsNotifyRoleId" TEXT;

-- CreateTable
CREATE TABLE "SigilRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigilRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigilRoleGrant" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SigilRoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "PollCategory" NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
    "creatorId" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "allowMultipleVotes" BOOLEAN NOT NULL DEFAULT false,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "discordMessageId" TEXT,
    "discordChannelId" TEXT,
    "mentionEveryone" BOOLEAN NOT NULL DEFAULT false,
    "mentionRoleId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "emoji" TEXT,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigilRole_guildId_idx" ON "SigilRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "SigilRole_guildId_slug_key" ON "SigilRole"("guildId", "slug");

-- CreateIndex
CREATE INDEX "SigilRoleGrant_profileId_idx" ON "SigilRoleGrant"("profileId");

-- CreateIndex
CREATE INDEX "SigilRoleGrant_expiresAt_idx" ON "SigilRoleGrant"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SigilRoleGrant_roleId_profileId_key" ON "SigilRoleGrant"("roleId", "profileId");

-- CreateIndex
CREATE INDEX "Poll_guildId_status_idx" ON "Poll"("guildId", "status");

-- CreateIndex
CREATE INDEX "Poll_expiresAt_idx" ON "Poll"("expiresAt");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_optionId_idx" ON "PollVote"("optionId");

-- CreateIndex
CREATE INDEX "PollVote_voterId_idx" ON "PollVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_optionId_voterId_key" ON "PollVote"("optionId", "voterId");

-- CreateIndex
CREATE INDEX "Submission_missionId_idx" ON "Submission"("missionId");

-- CreateIndex
CREATE INDEX "Submission_profileId_idx" ON "Submission"("profileId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "UserProfile_guildId_idx" ON "UserProfile"("guildId");

-- CreateIndex
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");

-- AddForeignKey
ALTER TABLE "SigilRole" ADD CONSTRAINT "SigilRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigilRoleGrant" ADD CONSTRAINT "SigilRoleGrant_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "SigilRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigilRoleGrant" ADD CONSTRAINT "SigilRoleGrant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
