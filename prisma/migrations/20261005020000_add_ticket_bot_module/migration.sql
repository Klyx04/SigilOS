-- AlterTable GuildModules
ALTER TABLE "GuildModules" ADD COLUMN IF NOT EXISTS "tickets" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TicketBotStatus" AS ENUM ('OPEN', 'CLAIMED', 'PENDING_USER', 'RESOLVED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TicketChannelType" AS ENUM ('CHANNEL_TEXT', 'THREAD_PRIVATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TicketButtonStyle" AS ENUM ('PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable TicketGuildConfig
CREATE TABLE IF NOT EXISTS "TicketGuildConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "logChannelId" TEXT,
    "transcriptsChannelId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxActiveTicketsPerUser" INTEGER NOT NULL DEFAULT 1,
    "maxTicketsTotalGuild" INTEGER NOT NULL DEFAULT 50,
    "enableCsat" BOOLEAN NOT NULL DEFAULT true,
    "enableDmNotifications" BOOLEAN NOT NULL DEFAULT true,
    "enableTranscripts" BOOLEAN NOT NULL DEFAULT true,
    "settingsJson" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketGuildConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketBotCategory
CREATE TABLE IF NOT EXISTS "TicketBotCategory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT DEFAULT '🎫',
    "buttonStyle" "TicketButtonStyle" NOT NULL DEFAULT 'PRIMARY',
    "channelType" "TicketChannelType" NOT NULL DEFAULT 'CHANNEL_TEXT',
    "channelParentId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "namingPattern" TEXT NOT NULL DEFAULT 'ticket-{num}',
    "formSchemaJson" JSONB NOT NULL DEFAULT '[]',
    "slaFirstResponseMin" INTEGER,
    "slaResolutionMin" INTEGER,
    "autoCloseWarningHours" INTEGER,
    "autoCloseHours" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketBotCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketBotPanel
CREATE TABLE IF NOT EXISTS "TicketBotPanel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "embedTitle" TEXT NOT NULL DEFAULT 'Centre de Support & Assistance',
    "embedDescription" TEXT NOT NULL DEFAULT 'Cliquez sur l''un des boutons ci-dessous pour ouvrir un ticket.',
    "embedColor" TEXT NOT NULL DEFAULT '#6366f1',
    "embedThumbnail" TEXT,
    "embedImage" TEXT,
    "embedFooter" TEXT DEFAULT 'SigilOS Tickets',
    "style" TEXT NOT NULL DEFAULT 'BUTTONS',
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketBotPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketRecord
CREATE TABLE IF NOT EXISTS "TicketRecord" (
    "id" TEXT NOT NULL,
    "ticketNumber" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "discordChannelId" TEXT,
    "discordThreadId" TEXT,
    "creatorDiscordId" TEXT NOT NULL,
    "creatorDiscordName" TEXT NOT NULL,
    "creatorAvatarUrl" TEXT,
    "creatorProfileId" TEXT,
    "status" "TicketBotStatus" NOT NULL DEFAULT 'OPEN',
    "claimedByDiscordId" TEXT,
    "claimedByName" TEXT,
    "claimedAt" TIMESTAMP(3),
    "firstStaffResponseAt" TIMESTAMP(3),
    "slaResponseBreached" BOOLEAN NOT NULL DEFAULT false,
    "slaResolveBreached" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warningSentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByDiscordId" TEXT,
    "closedByName" TEXT,
    "closedReason" TEXT,
    "intakeAnswersJson" JSONB DEFAULT '{}',
    "metadataJson" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketNote
CREATE TABLE IF NOT EXISTS "TicketNote" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "authorDiscordId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketTranscript
CREATE TABLE IF NOT EXISTS "TicketTranscript" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "storageRef" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "secretToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketFeedback
CREATE TABLE IF NOT EXISTS "TicketFeedback" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "creatorDiscordId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketAuditLog
CREATE TABLE IF NOT EXISTS "TicketAuditLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorDiscordId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detailsJson" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TicketGuildConfig_guildId_key" ON "TicketGuildConfig"("guildId");
CREATE INDEX IF NOT EXISTS "TicketGuildConfig_guildId_isEnabled_idx" ON "TicketGuildConfig"("guildId", "isEnabled");

CREATE UNIQUE INDEX IF NOT EXISTS "TicketBotCategory_guildId_slug_key" ON "TicketBotCategory"("guildId", "slug");
CREATE INDEX IF NOT EXISTS "TicketBotCategory_guildId_isEnabled_order_idx" ON "TicketBotCategory"("guildId", "isEnabled", "order");

CREATE INDEX IF NOT EXISTS "TicketBotPanel_guildId_idx" ON "TicketBotPanel"("guildId");

CREATE UNIQUE INDEX IF NOT EXISTS "TicketRecord_discordChannelId_key" ON "TicketRecord"("discordChannelId");
CREATE UNIQUE INDEX IF NOT EXISTS "TicketRecord_discordThreadId_key" ON "TicketRecord"("discordThreadId");
CREATE INDEX IF NOT EXISTS "TicketRecord_guildId_status_idx" ON "TicketRecord"("guildId", "status");
CREATE INDEX IF NOT EXISTS "TicketRecord_guildId_categoryId_idx" ON "TicketRecord"("guildId", "categoryId");
CREATE INDEX IF NOT EXISTS "TicketRecord_creatorDiscordId_status_idx" ON "TicketRecord"("creatorDiscordId", "status");
CREATE INDEX IF NOT EXISTS "TicketRecord_discordChannelId_idx" ON "TicketRecord"("discordChannelId");
CREATE INDEX IF NOT EXISTS "TicketRecord_discordThreadId_idx" ON "TicketRecord"("discordThreadId");

CREATE INDEX IF NOT EXISTS "TicketNote_ticketId_idx" ON "TicketNote"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketNote_guildId_idx" ON "TicketNote"("guildId");

CREATE UNIQUE INDEX IF NOT EXISTS "TicketTranscript_ticketId_key" ON "TicketTranscript"("ticketId");
CREATE UNIQUE INDEX IF NOT EXISTS "TicketTranscript_secretToken_key" ON "TicketTranscript"("secretToken");
CREATE INDEX IF NOT EXISTS "TicketTranscript_guildId_idx" ON "TicketTranscript"("guildId");

CREATE UNIQUE INDEX IF NOT EXISTS "TicketFeedback_ticketId_key" ON "TicketFeedback"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketFeedback_guildId_rating_idx" ON "TicketFeedback"("guildId", "rating");

CREATE INDEX IF NOT EXISTS "TicketAuditLog_ticketId_createdAt_idx" ON "TicketAuditLog"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "TicketAuditLog_guildId_action_idx" ON "TicketAuditLog"("guildId", "action");

-- Foreign Keys
DO $$ BEGIN
    ALTER TABLE "TicketGuildConfig" ADD CONSTRAINT "TicketGuildConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketBotCategory" ADD CONSTRAINT "TicketBotCategory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketBotPanel" ADD CONSTRAINT "TicketBotPanel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketRecord" ADD CONSTRAINT "TicketRecord_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketRecord" ADD CONSTRAINT "TicketRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketBotCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketNote" ADD CONSTRAINT "TicketNote_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketNote" ADD CONSTRAINT "TicketNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TicketRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketTranscript" ADD CONSTRAINT "TicketTranscript_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketTranscript" ADD CONSTRAINT "TicketTranscript_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TicketRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketFeedback" ADD CONSTRAINT "TicketFeedback_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketFeedback" ADD CONSTRAINT "TicketFeedback_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TicketRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketAuditLog" ADD CONSTRAINT "TicketAuditLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TicketAuditLog" ADD CONSTRAINT "TicketAuditLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TicketRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
