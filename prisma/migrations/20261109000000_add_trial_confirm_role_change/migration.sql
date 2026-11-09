-- AlterTable — V2 du cycle de vie des membres (09/11/2026).
-- Additif : une seule colonne, défaut `false` (comportement « un clic » inchangé pour toutes
-- les guildes existantes). Aucune donnée lue, modifiée ni supprimée.
ALTER TABLE "GuildConfig"
ADD COLUMN IF NOT EXISTS "trialConfirmRoleChange" BOOLEAN NOT NULL DEFAULT false;
