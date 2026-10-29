-- Rush Sylvestre — séparation « en construction » interne / public, et fondation du bloc B.
--
-- Constat : le MÊME drapeau `isUnderConstruction` pilotait la vue MEMBRES et la page
-- PUBLIQUE (`/guides/rush-sylvestre` + sitemap). Impossible d'ouvrir le guide au public
-- en laissant l'espace membres en chantier.
--
-- Fait :
--   ① `OptimizedGuide.isPublicUnderConstruction` (défaut `true`) — avis « En construction »
--      sur la page publique, `noindex` et hors sitemap. Le public est donc FERMÉ au
--      déploiement : il s'ouvre d'un clic, jamais par surprise.
--   ② `GuideSequence.publicSlug` (unique, nullable) — le slug d'une page par quête est FIGÉ
--      à la publication, jamais recalculé depuis le nom : sinon un renommage casserait une
--      URL déjà indexée (or `subGuideRef` porte le nom depuis l'éditeur God).
--   ③ `GuideSequence.isPublished` (défaut `false`) — une quête ajoutée dans le studio ne crée
--      AUCUNE page tant qu'elle n'est pas publiée explicitement.
--
-- Fondation ADDITIVE, sans backfill : aucune contrainte supprimée, aucun contenu créé.
-- Rejouable (`IF NOT EXISTS`).

ALTER TABLE "OptimizedGuide" ADD COLUMN IF NOT EXISTS "isPublicUnderConstruction" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "GuideSequence" ADD COLUMN IF NOT EXISTS "publicSlug" TEXT;
ALTER TABLE "GuideSequence" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "GuideSequence_publicSlug_key" ON "GuideSequence"("publicSlug");
