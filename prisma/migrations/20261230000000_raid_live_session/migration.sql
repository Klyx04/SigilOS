-- Lot 2 — session live de raid : chrono serveur + étape + objectifs.
-- Table standalone (aucune relation modifiée) : un event = une session.
-- Générée à la main car `migrate dev` est bloqué par la migration pré-existante
-- cassée `20261010000000_add_component_stats` (shadow DB, hors périmètre).

-- CreateTable
CREATE TABLE "RaidLiveSession" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "raidType" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LIVE',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "objectives" JSONB NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidLiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaidLiveSession_eventId_key" ON "RaidLiveSession"("eventId");

-- CreateIndex
CREATE INDEX "RaidLiveSession_guildId_status_idx" ON "RaidLiveSession"("guildId", "status");
