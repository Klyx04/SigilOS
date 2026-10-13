-- Module « Sondages programmés » (staff) — migration **additive**.
--
-- Pourquoi à la main : `migrate dev` est inutilisable sur cet historique local
-- (migration pré-existante cassée `20261010000000_add_component_stats`, cf. lots
-- God précédents). Le SQL ci-dessous est celui généré par
-- `prisma migrate diff --from-schema <avant> --to-schema prisma/schema.prisma --script`,
-- donc strictement aligné sur le datamodel (aucune dérive).
--
-- Contenu :
-- 1. `GuildModules.scheduledPolls` (OFF par défaut : un module n'est jamais actif à l'insu de la guilde) ;
-- 2. `GuildConfig` : salon d'embed, whitelist de ping et durée de vote par défaut du module ;
-- 3. `Poll.isScheduled` : tag « Sondage programmé » (carte, fiche, embed Discord) ;
-- 4. `ScheduledPoll` / `ScheduledPollOption` : créneaux (3 max par guilde, minute unique).

-- CreateEnum
CREATE TYPE "ScheduledPollStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS     "scheduledPollsChannelId" TEXT,
ADD COLUMN IF NOT EXISTS     "scheduledPollsDurationH" INTEGER,
ADD COLUMN IF NOT EXISTS     "scheduledPollsPingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "GuildModules" ADD COLUMN IF NOT EXISTS     "scheduledPolls" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS     "isScheduled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ScheduledPoll" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "PollCategory" NOT NULL,
    "allowMultipleVotes" BOOLEAN NOT NULL DEFAULT false,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "externalUrl" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationHours" INTEGER,
    "discordChannelId" TEXT,
    "mentionEveryone" BOOLEAN NOT NULL DEFAULT false,
    "mentionRoleId" TEXT,
    "status" "ScheduledPollStatus" NOT NULL DEFAULT 'SCHEDULED',
    "claimedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "lastError" TEXT,
    "createdPollId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPollOption" (
    "id" TEXT NOT NULL,
    "scheduledPollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "emoji" TEXT,

    CONSTRAINT "ScheduledPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPoll_guildId_status_idx" ON "ScheduledPoll"("guildId", "status");

-- CreateIndex
CREATE INDEX "ScheduledPoll_status_scheduledAt_idx" ON "ScheduledPoll"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledPoll_guildId_scheduledAt_key" ON "ScheduledPoll"("guildId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledPollOption_scheduledPollId_idx" ON "ScheduledPollOption"("scheduledPollId");

-- AddForeignKey
ALTER TABLE "ScheduledPoll" ADD CONSTRAINT "ScheduledPoll_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPollOption" ADD CONSTRAINT "ScheduledPollOption_scheduledPollId_fkey" FOREIGN KEY ("scheduledPollId") REFERENCES "ScheduledPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
