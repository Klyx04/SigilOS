-- Migration : Tour admin — enregistre la date de première ouverture du Dashboard par un admin
-- de la guilde (premier admin = reçoit le tour des modules une seule fois).
-- Champ ajouté sur GuildConfig : firstAdminViewAt (TIMESTAMP(3), nullable).
ALTER TABLE "GuildConfig" ADD COLUMN "firstAdminViewAt" TIMESTAMP(3);