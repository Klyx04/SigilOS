-- AlterTable: Add Welcome Module & Probation fields to GuildConfig
ALTER TABLE "GuildConfig"
  ADD COLUMN "systemNotifyChannelId"  TEXT,
  ADD COLUMN "welcomeEnabled"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "welcomeNotifyChannelId" TEXT,
  ADD COLUMN "welcomeDashboardEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "welcomeDiscordEnabled"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "welcomeMessageTemplate" TEXT,
  ADD COLUMN "welcomeMentionRoleId"   TEXT,
  ADD COLUMN "probationRoleName"      TEXT NOT NULL DEFAULT 'Période d''essai';

-- AlterTable: Add introduction field to UserProfile
ALTER TABLE "UserProfile"
  ADD COLUMN "introduction" TEXT;

-- CreateTable: MemberWelcome
CREATE TABLE "MemberWelcome" (
  "id"        TEXT NOT NULL,
  "guildId"   TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "reactions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MemberWelcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberWelcome_guildId_createdAt_idx" ON "MemberWelcome"("guildId", "createdAt");

-- AddForeignKey
ALTER TABLE "MemberWelcome" ADD CONSTRAINT "MemberWelcome_guildId_fkey"
  FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberWelcome" ADD CONSTRAINT "MemberWelcome_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
