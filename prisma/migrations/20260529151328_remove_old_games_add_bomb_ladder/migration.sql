/*
  Warnings:

  - You are about to drop the `GarticAlbum` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GarticAlbumEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GarticPlayerStats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GarticRoom` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GarticSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SkribblRank` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SkribblScore` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GarticAlbum" DROP CONSTRAINT "GarticAlbum_roomId_fkey";

-- DropForeignKey
ALTER TABLE "GarticAlbumEntry" DROP CONSTRAINT "GarticAlbumEntry_albumId_fkey";

-- DropForeignKey
ALTER TABLE "GarticPlayerStats" DROP CONSTRAINT "GarticPlayerStats_userId_fkey";

-- DropForeignKey
ALTER TABLE "GarticRoom" DROP CONSTRAINT "GarticRoom_guildId_fkey";

-- DropForeignKey
ALTER TABLE "GarticSession" DROP CONSTRAINT "GarticSession_roomId_fkey";

-- DropForeignKey
ALTER TABLE "GarticSession" DROP CONSTRAINT "GarticSession_userId_fkey";

-- DropTable
DROP TABLE "GarticAlbum";

-- DropTable
DROP TABLE "GarticAlbumEntry";

-- DropTable
DROP TABLE "GarticPlayerStats";

-- DropTable
DROP TABLE "GarticRoom";

-- DropTable
DROP TABLE "GarticSession";

-- DropTable
DROP TABLE "SkribblRank";

-- DropTable
DROP TABLE "SkribblScore";

-- CreateTable
CREATE TABLE "BombRank" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BombRank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BombScore" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BombScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BombRank_guildId_bestScore_idx" ON "BombRank"("guildId", "bestScore");

-- CreateIndex
CREATE UNIQUE INDEX "BombRank_guildId_userId_key" ON "BombRank"("guildId", "userId");

-- CreateIndex
CREATE INDEX "BombScore_guildId_createdAt_idx" ON "BombScore"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "BombScore_guildId_score_idx" ON "BombScore"("guildId", "score");
