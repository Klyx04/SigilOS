-- Migration : table AccessAttempt (observabilité des connexions refusées, fail-closed)
-- PII minimale : discordId + reason + createdAt. Rétention gérée par database-janitor.ts (> 90j).

CREATE TABLE "AccessAttempt" (
    "id"        TEXT        NOT NULL,
    "discordId" TEXT        NOT NULL,
    "reason"    TEXT        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessAttempt_pkey" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE INDEX "AccessAttempt_discordId_idx" ON "AccessAttempt"("discordId");

--> statement-breakpoint

CREATE INDEX "AccessAttempt_createdAt_idx" ON "AccessAttempt"("createdAt");
