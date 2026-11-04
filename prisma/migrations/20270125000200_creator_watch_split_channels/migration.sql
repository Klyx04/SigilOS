-- Annonces de créateurs — **deux salons** : Twitch et YouTube (04/11/2026).
--
-- POURQUOI : jusqu'ici un seul salon (`liveNotifyChannelId`) recevait les deux types d'annonce.
-- Le staff veut pouvoir envoyer les lives Twitch dans un salon et les nouvelles vidéos YouTube dans
-- un autre, avec un interrupteur par type.
--
-- CONTENU :
--   · GuildConfig.youtubeNotifyChannelId  (NULL = aucune annonce YouTube)
--   · GuildConfig.notifyTwitchLives       (défaut true, comme `notifyYouTubeUploads`)
--   · reprise des données : le salon existant est **recopié** vers YouTube, sans être modifié ni
--     supprimé, pour qu'aucune guilde ne perde ses annonces au déploiement. Idempotent : la seconde
--     exécution ne trouve plus de ligne à reprendre.
--
-- Écrite à la main (cf. docs/agents/prisma-schema-change.md §0). Additive ; la seule écriture de
-- données est la copie décrite ci-dessus, justifiée par la continuité de service.

ALTER TABLE "GuildConfig"
    ADD COLUMN IF NOT EXISTS "youtubeNotifyChannelId" TEXT;

ALTER TABLE "GuildConfig"
    ADD COLUMN IF NOT EXISTS "notifyTwitchLives" BOOLEAN NOT NULL DEFAULT true;

UPDATE "GuildConfig"
SET "youtubeNotifyChannelId" = "liveNotifyChannelId"
WHERE "youtubeNotifyChannelId" IS NULL
  AND "liveNotifyChannelId" IS NOT NULL;
