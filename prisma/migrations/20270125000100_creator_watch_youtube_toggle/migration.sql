-- Annonces de créateurs — interrupteur « nouvelles vidéos YouTube » (02/11/2026).
--
-- POURQUOI : le salon d'annonces (`liveNotifyChannelId`) sert aux **deux** types d'annonce
-- (live Twitch + nouvelle vidéo YouTube). Le staff doit pouvoir couper les vidéos sans couper
-- les lives — une colonne, défaut `true` (comportement attendu : les deux sont activés).
--
-- CONTENU : une colonne additive, avec défaut. Aucune donnée réécrite.
-- Écrite à la main (cf. docs/agents/prisma-schema-change.md §0). Additive et idempotente.

ALTER TABLE "GuildConfig"
    ADD COLUMN IF NOT EXISTS "notifyYouTubeUploads" BOOLEAN NOT NULL DEFAULT true;
