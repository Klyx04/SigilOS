-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('FORTUNE', 'GLADIATOR', 'HARVESTER', 'WISDOM', 'DIVINE');

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('PURCHASED', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MentionType" AS ENUM ('NONE', 'EVERYONE', 'ROLE');

-- CreateTable
CREATE TABLE "GuildBonus" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "bonusType" "BonusType" NOT NULL,
    "cost" INTEGER NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'PURCHASED',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasedBy" TEXT NOT NULL,
    "activatesAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "notificationChannelId" TEXT,
    "notificationMessageId" TEXT,
    "mentionType" "MentionType" NOT NULL DEFAULT 'NONE',
    "mentionRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildBonus_guildId_status_idx" ON "GuildBonus"("guildId", "status");

-- CreateIndex
CREATE INDEX "GuildBonus_activatesAt_idx" ON "GuildBonus"("activatesAt");

-- AddForeignKey
ALTER TABLE "GuildBonus" ADD CONSTRAINT "GuildBonus_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
