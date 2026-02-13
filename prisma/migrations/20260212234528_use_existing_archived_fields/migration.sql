/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `deletionReason` on the `UserProfile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "deletedAt",
DROP COLUMN "deletionReason";
