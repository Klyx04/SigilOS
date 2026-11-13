-- Chantier Y — « Rôles automatiques par ancienneté » (lot Y-1 : données + règles pures).
--
-- Migration **additive** : 4 colonnes sur `GuildConfig`, aucune donnée réécrite — le
-- module est OFF tant que l'admin ne l'active pas explicitement.
--
-- Pourquoi écrite à la main : `migrate dev` est inutilisable sur cet historique local
-- (migration pré-existante cassée `20261010000000_add_component_stats`, cf. lots God
-- précédents) ; le SQL ci-dessous est celui du datamodel, aligné sur
-- `prisma/schema.prisma` (aucune dérive), même méthode que
-- `20270102000000_add_scheduled_polls`.
--
-- Contenu :
-- 1. `seniorityRolesEnabled` : activation de guilde, OFF par défaut ;
-- 2. `seniorityRolesChannelId` : salon de l'annonce (NULL = rôles posés sans annonce) ;
-- 3. `seniorityRolesTiers` : paliers `[{ days, roleIds }]`, relus par
--    `normalizeSeniorityTiers` (bornés, dédoublonnés, triés par seuil) ;
-- 4. `seniorityRolesAnnouncement` : message personnalisable (ping, titre, description,
--    couleur, miniature), relu par `mergeSeniorityAnnouncement` (défauts si absent).

ALTER TABLE "GuildConfig"
    ADD COLUMN IF NOT EXISTS "seniorityRolesEnabled"      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "seniorityRolesChannelId"    TEXT,
    ADD COLUMN IF NOT EXISTS "seniorityRolesTiers"        JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "seniorityRolesAnnouncement" JSONB;
