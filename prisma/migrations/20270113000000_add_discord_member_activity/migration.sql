-- Lot 7 — activité Discord **de tous les membres** (y compris ceux qui n'ont pas de profil).
--
-- POURQUOI : `UserProfile.discordVoiceTime*` / `discordMessageCount*` ne sont écrits que
-- pour les membres **inscrits au dashboard** (le bot ne trouve personne d'autre). C'était
-- l'angle mort du moteur de rôles « vocal » : un membre non inscrit pèse 0.
--
-- CE QU'ELLE CONTIENT : une table additive, une ligne par couple (guilde, membre Discord),
-- avec des **compteurs** et des **horodatages** — aucun contenu de message, aucun token.
-- `leftDiscordAt` est posé au départ et sert de point de départ à la purge (365 jours).
--
-- AUCUNE DONNÉE RÉÉCRITE : la table est neuve ; les profils existants ne sont pas touchés.
-- La colonne de rétention est **indexée** (`guildId`, `leftDiscordAt`) : la purge reste
-- une seule requête bornée, jamais un balayage complet.

CREATE TABLE "DiscordMemberActivity" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "displayName" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),
    "lastVoiceAt" TIMESTAMP(3),
    "messagesTotal" INTEGER NOT NULL DEFAULT 0,
    "voiceSecondsTotal" INTEGER NOT NULL DEFAULT 0,
    "leftDiscordAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscordMemberActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscordMemberActivity_guildId_discordId_key" ON "DiscordMemberActivity"("guildId", "discordId");
CREATE INDEX "DiscordMemberActivity_guildId_leftDiscordAt_idx" ON "DiscordMemberActivity"("guildId", "leftDiscordAt");
CREATE INDEX "DiscordMemberActivity_guildId_lastSeenAt_idx" ON "DiscordMemberActivity"("guildId", "lastSeenAt");

ALTER TABLE "DiscordMemberActivity" ADD CONSTRAINT "DiscordMemberActivity_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
