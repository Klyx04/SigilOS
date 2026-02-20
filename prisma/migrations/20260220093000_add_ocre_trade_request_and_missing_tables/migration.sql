-- CreateEnum: TradeStatus
DO $$ BEGIN
    CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing Ocre notification variants to NotificationType enum
-- (using DO block to be safe if they already exist)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OCRE_TRADE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OCRE_TRADE_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OCRE_TRADE_REJECTED';

-- CreateTable: OcreTradeRequest
CREATE TABLE IF NOT EXISTS "OcreTradeRequest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "monsterId" INTEGER NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcreTradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OcreTradeRequest_guildId_status_idx" ON "OcreTradeRequest"("guildId", "status");
CREATE INDEX IF NOT EXISTS "OcreTradeRequest_targetId_status_idx" ON "OcreTradeRequest"("targetId", "status");
CREATE INDEX IF NOT EXISTS "OcreTradeRequest_requesterId_status_idx" ON "OcreTradeRequest"("requesterId", "status");

-- CreateTable: _DungeonToZone (Many-to-Many join table)
CREATE TABLE IF NOT EXISTS "_DungeonToZone" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex for _DungeonToZone
CREATE UNIQUE INDEX IF NOT EXISTS "_DungeonToZone_AB_unique" ON "_DungeonToZone"("A", "B");
CREATE INDEX IF NOT EXISTS "_DungeonToZone_B_index" ON "_DungeonToZone"("B");

-- AddForeignKey: OcreTradeRequest -> GuildConfig
ALTER TABLE "OcreTradeRequest" DROP CONSTRAINT IF EXISTS "OcreTradeRequest_guildId_fkey";
ALTER TABLE "OcreTradeRequest" ADD CONSTRAINT "OcreTradeRequest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OcreTradeRequest -> UserProfile (Requester)
ALTER TABLE "OcreTradeRequest" DROP CONSTRAINT IF EXISTS "OcreTradeRequest_requesterId_fkey";
ALTER TABLE "OcreTradeRequest" ADD CONSTRAINT "OcreTradeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OcreTradeRequest -> UserProfile (Target)
ALTER TABLE "OcreTradeRequest" DROP CONSTRAINT IF EXISTS "OcreTradeRequest_targetId_fkey";
ALTER TABLE "OcreTradeRequest" ADD CONSTRAINT "OcreTradeRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: _DungeonToZone
ALTER TABLE "_DungeonToZone" DROP CONSTRAINT IF EXISTS "_DungeonToZone_A_fkey";
ALTER TABLE "_DungeonToZone" ADD CONSTRAINT "_DungeonToZone_A_fkey" FOREIGN KEY ("A") REFERENCES "Dungeon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_DungeonToZone" DROP CONSTRAINT IF EXISTS "_DungeonToZone_B_fkey";
ALTER TABLE "_DungeonToZone" ADD CONSTRAINT "_DungeonToZone_B_fkey" FOREIGN KEY ("B") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix DreamRun index: replace single leaderId index with composite (leaderId, status)
DROP INDEX IF EXISTS "DreamRun_leaderId_idx";
CREATE INDEX IF NOT EXISTS "DreamRun_leaderId_status_idx" ON "DreamRun"("leaderId", "status");

-- Fix Submission index: replace single status index with composite (status, updatedAt)
DROP INDEX IF EXISTS "Submission_status_idx";
CREATE INDEX IF NOT EXISTS "Submission_status_updatedAt_idx" ON "Submission"("status", "updatedAt");
