/*
  Warnings:

  - Made the column `summary` on table `ChangelogEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ChangelogEntry" ALTER COLUMN "summary" SET NOT NULL;

-- CreateTable
CREATE TABLE "GuildModules" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "songes" BOOLEAN NOT NULL DEFAULT true,
    "missions" BOOLEAN NOT NULL DEFAULT true,
    "ocre" BOOLEAN NOT NULL DEFAULT true,
    "calendar" BOOLEAN NOT NULL DEFAULT true,
    "ladder" BOOLEAN NOT NULL DEFAULT true,
    "docs" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "GuildModules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildModules_guildId_key" ON "GuildModules"("guildId");

-- AddForeignKey
ALTER TABLE "GuildModules" ADD CONSTRAINT "GuildModules_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
