-- Salon Discord public des remerciements Ko-fi (#DONS-KOFI).
-- Idempotent : rejouable sans erreur si la colonne existe deja (drift hors migrations).
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "kofiChannelId" TEXT;
