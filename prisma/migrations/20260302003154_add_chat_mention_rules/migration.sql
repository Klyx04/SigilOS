-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "chatMentionRules" JSONB NOT NULL DEFAULT '{}';
