-- Toggle du catalogue des commandes slash (cohérence "désactivé = invisible").
-- Défaut true : les guildes déjà onboardées gardent l'entrée visible ;
-- les nouvelles guildes partent de DEFAULT_MODULES (false) jusqu'à activation.
ALTER TABLE "GuildModules" ADD COLUMN "commandes" BOOLEAN NOT NULL DEFAULT true;
