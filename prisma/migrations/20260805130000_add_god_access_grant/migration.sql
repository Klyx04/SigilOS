-- Migration : D1 - Grant granulaire par BRIQUE (PIM)
CREATE TABLE "GodAccessGrant" (
    "id" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brickId" TEXT NOT NULL,
    "guildId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "grantedBy" TEXT NOT NULL,
    "reason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GodAccessGrant_pkey" PRIMARY KEY ("id")
);
--> statement-breakpoint
CREATE INDEX "GodAccessGrant_delegateId_idx" ON "GodAccessGrant"("delegateId");
CREATE INDEX "GodAccessGrant_userId_idx" ON "GodAccessGrant"("userId");
CREATE INDEX "GodAccessGrant_brickId_idx" ON "GodAccessGrant"("brickId");
CREATE INDEX "GodAccessGrant_revokedAt_idx" ON "GodAccessGrant"("revokedAt");
CREATE INDEX "GodAccessGrant_expiresAt_idx" ON "GodAccessGrant"("expiresAt");