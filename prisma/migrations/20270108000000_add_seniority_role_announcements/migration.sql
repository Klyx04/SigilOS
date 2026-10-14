-- Chantier Y — « Rôles automatiques par ancienneté » (lot Y-2 : cron + embed).
--
-- Migration **additive** : une colonne sur `GuildConfig` + une table de suivi. Aucune
-- donnée existante n'est lue ni réécrite.
--
-- Pourquoi écrite à la main : `migrate dev` est inutilisable sur cet historique local
-- (migration pré-existante cassée `20261010000000_add_component_stats`) — SQL aligné sur le
-- datamodel, même méthode que `20270107000000_add_seniority_roles_config`.
--
-- Contenu :
-- 1. `GuildConfig.seniorityRolesActivatedAt` : instant d'activation du module, par guilde.
--    C'est LUI qui décide ce qui est fêté : un palier franchi **après** cette date est un
--    événement (embed), un palier franchi **avant** est un **rattrapage** — les rôles sont
--    posés, rien n'est posté (décision user du 14/10/2026) ;
-- 2. `SeniorityRoleAnnouncement` : un palier déjà fêté, une fois pour toutes. La contrainte
--    `(guildId, discordId, tierDays)` est la **garde d'idempotence** : deux passes
--    concurrentes ne peuvent pas annoncer le même palier deux fois.

ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "seniorityRolesActivatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SeniorityRoleAnnouncement" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "tierDays" INTEGER NOT NULL,
    "announcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeniorityRoleAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeniorityRoleAnnouncement_guildId_discordId_tierDays_key" ON "SeniorityRoleAnnouncement"("guildId", "discordId", "tierDays");

CREATE INDEX IF NOT EXISTS "SeniorityRoleAnnouncement_guildId_idx" ON "SeniorityRoleAnnouncement"("guildId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SeniorityRoleAnnouncement_guildId_fkey'
    ) THEN
        ALTER TABLE "SeniorityRoleAnnouncement"
            ADD CONSTRAINT "SeniorityRoleAnnouncement_guildId_fkey"
            FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
