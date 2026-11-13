-- Rush — conditions structurées d'une quête (horaire, joueurs, métiers, sorts, notes).
-- Des **infos** affichées dans le dashboard, le guide public et l'overlay ; jamais une
-- règle de blocage. Forme validée côté serveur par `rushQuestConstraintsSchema`.
--
-- Fondation ADDITIVE : aucune contrainte supprimée, aucun backfill. Rejouable.

ALTER TABLE "GuideSequence" ADD COLUMN IF NOT EXISTS "constraints" JSONB;
