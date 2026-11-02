-- Notifications de live Discord + mesure d'activité réelle (02/11/2026).
--
-- POURQUOI
--  · Live : le bloc « est en LIVE » ne notifiait que le dashboard, et seulement si un membre
--    ouvrait la page (cache paresseux — aucun cron). Une annonce Discord exige une décision
--    **par guilde** (salon + rôles à ping), donc deux colonnes. `livePingRoleIds` vide = sans
--    ping : jamais `@everyone` par défaut.
--  · D-A : les sessions sont en JWT (`src/auth.ts`), donc aucune date de dernière connexion
--    n'existait en base. La rétention des comptes ne mesurait que l'**âge du compte** et
--    pouvait effacer quelqu'un qui s'était connecté la veille. `User.lastSeenAt` porte
--    l'activité réelle (écrite au plus 1×/h, cf. `src/server/last-seen.ts`).
--
-- CONTENU : trois colonnes additives, aucune donnée réécrite.
--   · GuildConfig.liveNotifyChannelId  (NULL = module éteint pour cette guilde)
--   · GuildConfig.livePingRoleIds      (défaut vide → aucun ping)
--   · User.lastSeenAt                  (NULL = jamais mesuré → traité comme inactif)
--
-- Écrite à la main : `prisma migrate dev` est inutilisable sur cet historique local (base en
-- drift, cf. docs/agents/prisma-schema-change.md §0). Additive et idempotente.

ALTER TABLE "GuildConfig"
    ADD COLUMN IF NOT EXISTS "liveNotifyChannelId" TEXT;

ALTER TABLE "GuildConfig"
    ADD COLUMN IF NOT EXISTS "livePingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
