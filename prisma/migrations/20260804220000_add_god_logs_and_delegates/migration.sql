-- Migration manuelle : isolation des logs God + delegation sub-god + fallback ladder
-- 
-- 1. AuditLog : guildId devient optionnel (null pour les actions God), + isGodLog
-- 2. Table GodDelegate (sub-gods avec scopes granulaires)
-- 3. PlatformConfig : toggle fallback ladder manuel + toggle recherche locale quetes

-- ---------------------------------------------------------------------------
-- 1. AuditLog : guildId nullable + isGodLog
-- ---------------------------------------------------------------------------

-- Supprimer la FK existante vers GuildConfig (elle exigeait un guildId non-null)
-- On retrouve automatiquement le nom de contrainte via information_schema.
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = '"AuditLog"'::regclass
      AND contype = 'f'
      AND confrelid = '"GuildConfig"'::regclass
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE "AuditLog" DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

--> statement-breakpoint

-- Rendre guildId optionnel (null = action plateforme / God)
ALTER TABLE "AuditLog" ALTER COLUMN "guildId" DROP NOT NULL;

--> statement-breakpoint

-- Nouvelle colonne pour marquer les logs God (super-admin isolés des logs de guilde)
ALTER TABLE "AuditLog" ADD COLUMN "isGodLog" BOOLEAN NOT NULL DEFAULT false;

--> statement-breakpoint

-- Recréer la FK avec ON DELETE CASCADE (comportement d'origine conservé)
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

--> statement-breakpoint

-- Index utilitaire pour isoler/récupérer rapidement les logs God
CREATE INDEX "AuditLog_isGodLog_idx" ON "AuditLog"("isGodLog");

--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Table GodDelegate (sub-gods, sécurité fail-closed : aucun scope par défaut)
-- ---------------------------------------------------------------------------
CREATE TABLE "GodDelegate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT,
    "scopes" TEXT[],
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GodDelegate_pkey" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE INDEX "GodDelegate_userId_idx" ON "GodDelegate"("userId");
CREATE INDEX "GodDelegate_guildId_idx" ON "GodDelegate"("guildId");
CREATE INDEX "GodDelegate_revokedAt_idx" ON "GodDelegate"("revokedAt");

--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. PlatformConfig : toggle fallback ladder manuel (God) + recherche locale
-- ---------------------------------------------------------------------------
ALTER TABLE "PlatformConfig" ADD COLUMN "ladderManualFallback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformConfig" ADD COLUMN "ladderManualFallbackUpdatedAt" TIMESTAMP(3);
ALTER TABLE "PlatformConfig" ADD COLUMN "ladderManualFallbackUpdatedBy" TEXT;
ALTER TABLE "PlatformConfig" ADD COLUMN "questSearchLocalFirst" BOOLEAN NOT NULL DEFAULT true;