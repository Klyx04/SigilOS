-- 🧺 Module « Marché » — **option A** : un message Discord par objet
-- (décision user du 14/09/2026, plan `PLAN-LOT-MULTIPLE.md` §Discord).
--
-- Fondation ADDITIVE : on stocke **sur l'objet** l'identifiant du message Discord
-- qui lui est dédié. `MarketDiscordMessage` continue de porter le message de
-- l'annonce elle-même (`componentId = NULL`) : **aucune contrainte n'est
-- supprimée**, aucun appel existant (`where: { listingId }`) n'est cassé, aucun
-- backfill n'est nécessaire (colonnes nullables, les annonces actuelles restent
-- avec `NULL` = « pas de message par objet »).
--
-- Migration IDEMPOTENTE (rejouable sans dégât) : `IF NOT EXISTS` partout.

ALTER TABLE "MarketListingComponent" ADD COLUMN IF NOT EXISTS "discordChannelId" TEXT;
ALTER TABLE "MarketListingComponent" ADD COLUMN IF NOT EXISTS "discordMessageId" TEXT;

CREATE INDEX IF NOT EXISTS "MarketListingComponent_discordMessageId_idx"
    ON "MarketListingComponent" ("discordMessageId");
