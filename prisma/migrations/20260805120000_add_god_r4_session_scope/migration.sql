
-- Migration : R4 - Session God + révocation live + logging exhaustif
-- 1. GodDelegate : ajout scopeVersion (bump à chaque révocation pour invalider sessions)
-- 2. Nouvelle table GodAccessLog (journal des accès God)
-- 3. Nouvelle table GodSessionLog (suivi de session active)

-- ---------------------------------------------------------------------------
-- 1. GodDelegate : scopeVersion
-- ---------------------------------------------------------------------------
ALTER TABLE "GodDelegate" ADD COLUMN "scopeVersion" INTEGER NOT NULL DEFAULT 0;

--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. GodAccessLog : journal des accès
-- ---------------------------------------------------------------------------
CREATE TABLE "GodAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GodAccessLog_pkey" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE INDEX "GodAccessLog_userId_idx" ON "GodAccessLog"("userId");
CREATE INDEX "GodAccessLog_createdAt_idx" ON "GodAccessLog"("createdAt");

--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. GodSessionLog : suivi de session
-- ---------------------------------------------------------------------------
CREATE TABLE "GodSessionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GodSessionLog_pkey" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE INDEX "GodSessionLog_userId_idx" ON "GodSessionLog"("userId");
CREATE INDEX "GodSessionLog_active_idx" ON "GodSessionLog"("active");

