-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "hasSeenWelcome" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GuildModules" ADD COLUMN "admin" BOOLEAN NOT NULL DEFAULT true;
