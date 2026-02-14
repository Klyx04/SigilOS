/*
  Warnings:

  - Added the required column `summary` to the `ChangelogEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ChangelogEntry" ADD COLUMN     "summary" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PlatformBan" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBan_discordId_key" ON "PlatformBan"("discordId");

-- CreateIndex
CREATE INDEX "PlatformBan_entityType_idx" ON "PlatformBan"("entityType");
