-- Rôles Discord comptés comme « en guilde en jeu » (module Membres → onglet Mules).
--
-- Migration ADDITIVE : on ajoute une colonne **vide** avec une valeur par défaut, aucune
-- ligne existante n'est réécrite, aucun index (la liste est lue avec la configuration de
-- la guilde, jamais filtrée en SQL). Une liste vide = aucun rôle compté.
ALTER TABLE "GuildConfig" ADD COLUMN "inGameGuildRoleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
