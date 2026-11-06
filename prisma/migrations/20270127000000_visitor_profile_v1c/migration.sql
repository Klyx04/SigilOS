-- Espace visiteur (rang 57) — lot V1c : logo retiré, mules, métiers en nom (06/11/2026).
--
-- Trois changements, tous sur des emplacements **sans écrivain** (mesuré le 06/11/2026) :
--   · `declaredGuildLogoUrl` : aucun writer, aucune URL d'image (D-V7) → retrait sans perte ;
--   · `altPseudos` : case des mules, même forme que `UserProfile.altPseudos`
--     (`{ pseudo, classe?, level? }[]`) — additive ;
--   · `PublicProfession.metierId` : la table est **vide** ; l'entier n'avait aucun
--     référentiel stable (les seuls ids numériques du dépôt sont dérivés de l'ordre des
--     tableaux, `src/lib/dofusdude-client.ts`) → texte = slug `DOFUS_JOBS` (`forgeron`).
--
-- Idempotente et rejouable : `IF EXISTS` / `IF NOT EXISTS`, et `ALTER TYPE` est un no-op
-- quand la colonne est déjà en texte.

ALTER TABLE "PublicProfile" DROP COLUMN IF EXISTS "declaredGuildLogoUrl";

ALTER TABLE "PublicProfile" ADD COLUMN IF NOT EXISTS "altPseudos" JSONB;

ALTER TABLE "PublicProfession" ALTER COLUMN "metierId" TYPE TEXT USING "metierId"::text;
