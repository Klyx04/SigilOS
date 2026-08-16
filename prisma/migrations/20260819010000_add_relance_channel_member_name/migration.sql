-- Chantier #104 : canal de relance configurable par l'admin guilde
-- (diffusion des relances « ping canal » au lieu d'un choix à la volée).
ALTER TABLE "GuildConfig" ADD COLUMN "relanceChannelId" TEXT;

-- Chantier #105 : nom affiché du membre exclu dans l'onglet « Exclus »
-- (au lieu de l'ID Discord brut), conservé après anonymisation du profil.
ALTER TABLE "GuildMemberBan" ADD COLUMN "memberName" TEXT;
