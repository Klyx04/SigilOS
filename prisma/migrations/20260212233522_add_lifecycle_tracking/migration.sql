/*
  Warnings:

  - You are about to drop the column `difficulty` on the `Challenge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "difficulty";

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "scheduledDeletion" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "emailBackup" TEXT,
ADD COLUMN     "scheduledDeletion" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "scheduledDeletion" TIMESTAMP(3);
