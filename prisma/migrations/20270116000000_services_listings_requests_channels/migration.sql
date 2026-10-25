-- Module Services : **deux salons distincts** + mapping des tags de forum.
--
-- Pourquoi cette migration existe (25/10/2026) : un seul champ
-- (`servicesNotifyChannelId`) servait à la fois aux **cartes d'annonce** et aux
-- **demandes client**. Or les deux flux n'ont pas le même besoin : une annonce
-- veut un **forum** (un sujet par service, filtrable par tag), une demande veut
-- un salon qui reçoit un message/sujet par client. Résultat mesuré : un salon
-- configuré pour l'un ne convenait pas à l'autre (et en forum, la demande
-- n'était même pas publiée).
--
-- Contenu (ADDITIF, idempotent, aucune perte) :
--   · `servicesListingsChannelId` — annonces de services (forum obligatoire,
--     validé au moment de l'enregistrement, jamais figé en base) ;
--   · `servicesRequestsChannelId` — demandes des clients (forum **ou** texte) ;
--   · `servicesForumTags`        — mapping `ServiceCategory → id de tag` (jsonb),
--     tags **créés côté Discord** puis lus via `available_tags`.
-- Backfill : les guildes déjà configurées gardent leurs annonces là où elles
-- étaient ; `servicesNotifyChannelId` reste en place et sert de **repli** pour
-- les demandes tant que l'admin n'a pas choisi le salon dédié.
--
-- Écrite à la main (cf. `docs/agents/prisma-schema-change.md` §0 : `migrate dev`
-- est inutilisable sur cet historique local).

ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "servicesListingsChannelId" TEXT;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "servicesRequestsChannelId" TEXT;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "servicesForumTags" JSONB;

-- Backfill : le salon historique devient le salon des annonces.
UPDATE "GuildConfig"
SET "servicesListingsChannelId" = "servicesNotifyChannelId"
WHERE "servicesListingsChannelId" IS NULL
  AND "servicesNotifyChannelId" IS NOT NULL;
