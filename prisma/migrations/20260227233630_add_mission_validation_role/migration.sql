/*
  Warnings:

  - You are about to drop the column `probationRoleName` on the `GuildConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GuildConfig" DROP COLUMN "probationRoleName",
ADD COLUMN     "missionValidationNotifyRoleId" TEXT,
ADD COLUMN     "welcomeBadgeName" TEXT NOT NULL DEFAULT 'Nouveau',
ADD COLUMN     "welcomeDiscordMessageTemplate" TEXT;
