-- Migration additive : kill-switch God des modules au niveau plateforme (A2 · G12).
-- Idempotente (`ADD COLUMN IF NOT EXISTS`) — règle de la PR #614 : une migration
-- ne doit jamais casser un environnement où la colonne existe déjà.
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "disabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "moduleNotices" JSONB;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "disabledModulesUpdatedAt" TIMESTAMP(3);
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "disabledModulesUpdatedBy" TEXT;
