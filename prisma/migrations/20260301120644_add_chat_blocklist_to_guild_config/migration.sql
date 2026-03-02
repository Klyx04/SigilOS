-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "chatBlocklist" JSONB NOT NULL DEFAULT '[]';
