-- Rush Sylvestre — blocs Combat tactique / semi-tactique + liens externes des blocs.
--
-- ① deux valeurs d'enum (blocs d'information, non cochables) ;
-- ② `GuideMilestone.links` : liens nommés (vidéos, guides écrits) — JSON nullable,
--    aucun backfill. Forme validée côté serveur par `rush-block-links`.
--
-- Migration additive : aucune colonne supprimée, aucune donnée réécrite.
-- Rejouable (`IF NOT EXISTS`).

ALTER TYPE "GuideMilestoneType" ADD VALUE IF NOT EXISTS 'COMBAT_TACTIQUE';
ALTER TYPE "GuideMilestoneType" ADD VALUE IF NOT EXISTS 'COMBAT_SEMI_TACTIQUE';

ALTER TABLE "GuideMilestone" ADD COLUMN IF NOT EXISTS "links" JSONB;
