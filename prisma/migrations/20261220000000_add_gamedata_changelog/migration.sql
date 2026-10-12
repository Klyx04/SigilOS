-- 🔍 Journal des changements des siphons game-data — « quoi a changé, avant → après ».
-- Rétention bornée côté application (30 j / 500 entrées par dataset, purge à l'écriture) :
-- cette table ne doit jamais croître sans limite.

CREATE TABLE "GameDataChangeLog" (
    "id" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT,
    "changeType" TEXT NOT NULL,
    "fields" JSONB,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameDataChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GameDataChangeLog_dataset_createdAt_idx" ON "GameDataChangeLog"("dataset", "createdAt");

CREATE INDEX "GameDataChangeLog_dataset_entityId_idx" ON "GameDataChangeLog"("dataset", "entityId");

CREATE INDEX "GameDataChangeLog_createdAt_idx" ON "GameDataChangeLog"("createdAt");
