-- AlterTable: Add missing ocreNotifyChannelId column to GuildConfig
-- This column was added to schema.prisma but the migration was never generated.

ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "ocreNotifyChannelId" TEXT;
