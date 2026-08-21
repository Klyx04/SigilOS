-- CreateTable
CREATE TABLE "DofensiveDungeon" (
    "id" TEXT NOT NULL,
    "dungeonId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "maps" JSONB NOT NULL,
    "monsters" JSONB NOT NULL,
    "bossMonsterId" INTEGER,
    "versionHash" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DofensiveDungeon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DofensiveMap" (
    "id" TEXT NOT NULL,
    "mapId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "dungeonId" INTEGER,
    "subarea" JSONB,
    "coords" JSONB,
    "cells" JSONB NOT NULL,
    "allyCells" JSONB NOT NULL,
    "enemyCells" JSONB NOT NULL,
    "isBossMap" BOOLEAN NOT NULL DEFAULT false,
    "versionHash" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DofensiveMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonsterStat" (
    "id" TEXT NOT NULL,
    "monsterId" INTEGER NOT NULL,
    "monsterName" TEXT NOT NULL,
    "dungeonName" TEXT,
    "stats" JSONB NOT NULL,
    "versionHash" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonsterStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DofensiveDungeon_dungeonId_key" ON "DofensiveDungeon"("dungeonId");

-- CreateIndex
CREATE INDEX "DofensiveDungeon_lastSyncedAt_idx" ON "DofensiveDungeon"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DofensiveMap_mapId_key" ON "DofensiveMap"("mapId");

-- CreateIndex
CREATE INDEX "DofensiveMap_dungeonId_idx" ON "DofensiveMap"("dungeonId");

-- CreateIndex
CREATE INDEX "DofensiveMap_lastSyncedAt_idx" ON "DofensiveMap"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonsterStat_monsterId_key" ON "MonsterStat"("monsterId");

-- CreateIndex
CREATE INDEX "MonsterStat_monsterName_idx" ON "MonsterStat"("monsterName");

-- CreateIndex
CREATE INDEX "MonsterStat_lastSyncedAt_idx" ON "MonsterStat"("lastSyncedAt");
