-- Règlement intérieur de guilde (présentation) : champ HTML édité en TipTap,
-- lu côté dashboard/guild-hub uniquement, jamais servi au public.
-- Migration ADDITIVE (aucune réécriture de données) : colonne nullable, sans défaut.
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "presentationInternalRules" TEXT;
