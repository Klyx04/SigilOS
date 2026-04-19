/*
  Warnings:

  - You are about to drop the column `chatBlocklist` on the `GuildConfig` table. All the data in the column will be lost.
  - You are about to drop the column `chatMentionRules` on the `GuildConfig` table. All the data in the column will be lost.
  - You are about to drop the column `chatMotd` on the `GuildConfig` table. All the data in the column will be lost.
  - You are about to drop the column `chat` on the `GuildModules` table. All the data in the column will be lost.
  - You are about to drop the `SigilKingRank` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SigilKingScore` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SigilKingSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SigilKingSessionPlayer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SigilKingSessionPlayer" DROP CONSTRAINT "SigilKingSessionPlayer_sessionId_fkey";

-- AlterTable
ALTER TABLE "GuildConfig" DROP COLUMN "chatBlocklist",
DROP COLUMN "chatMentionRules",
DROP COLUMN "chatMotd";

-- AlterTable
ALTER TABLE "GuildModules" DROP COLUMN "chat";

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "hiddenNavItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "SigilKingRank";

-- DropTable
DROP TABLE "SigilKingScore";

-- DropTable
DROP TABLE "SigilKingSession";

-- DropTable
DROP TABLE "SigilKingSessionPlayer";
