-- Kill-switch God de l'auto-onboarding (nouvelles guildes uniquement)
ALTER TABLE "PlatformConfig" ADD COLUMN "autoOnboardingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Verrou God de modules par guilde (noms de ModuleKey, mappings conservés)
ALTER TABLE "GuildModules" ADD COLUMN "disabledByGod" TEXT[] NOT NULL DEFAULT '{}';

-- Demandes de récupération des guildes orphelines (jamais d'auto-élévation)
CREATE TABLE "GuildRecoveryClaim" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "claimantUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    CONSTRAINT "GuildRecoveryClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuildRecoveryClaim_guildId_idx" ON "GuildRecoveryClaim"("guildId");
CREATE INDEX "GuildRecoveryClaim_status_idx" ON "GuildRecoveryClaim"("status");
