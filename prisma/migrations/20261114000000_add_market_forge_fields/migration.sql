-- S8.10 : déclaration de forge réelle (D40/D41) — 6 colonnes NULLABLES, AUCUN backfill.
-- Idempotent (drift beta : colonnes possiblement créées hors migrations) : rejouable sans erreur.
-- `transcendenceRuneId` porte à lui seul l'état « Transcendé » (aucun booléen redondant).
-- `elementPotionTier` (50|65|80) porte la donnée de jeu : les 4 potions du palier 65 %
-- ne sont pas encore siphonnées dans `GameItem` (`elementPotionId` reste alors NULL).
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "transcendenceRuneId" INTEGER;
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "transcendenceLabel"  TEXT;
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "strikeElement"       TEXT;
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "elementPotionId"     INTEGER;
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "elementPotionTier"   INTEGER;
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "huntingWeapon"       TEXT;
