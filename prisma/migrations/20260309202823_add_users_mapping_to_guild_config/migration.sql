-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "usersMapping" JSONB NOT NULL DEFAULT '{}';
