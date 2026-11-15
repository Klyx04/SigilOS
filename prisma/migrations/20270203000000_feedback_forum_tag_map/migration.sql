-- 20270203000000_feedback_forum_tag_map
--
-- POURQUOI : le salon des captures peut être un forum. Le tag du post doit
-- pouvoir être choisi par type de retour (« Bug » → tag Bug, « Amélioration »
-- → tag Amélioration) côté God, sans redéploiement.
-- CONTENU : une colonne JSONB nullable sur `PlatformConfig` (singleton).
--   · clé absente = repli sur le premier tag utilisable du forum ;
--   · aucune donnée réécrite, aucune valeur par défaut.
-- ÉCRITE À LA MAIN : ce dépôt n'utilise pas `migrate dev` (base locale en drift,
-- cf. docs/agents/prisma-schema-change.md §0). Additive et idempotente.

ALTER TABLE "PlatformConfig"
  ADD COLUMN IF NOT EXISTS "feedbackForumTagMap" JSONB;
