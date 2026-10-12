-- Succès « Spéciaux » — la mécanique réelle est **propre au donjon** (elle dépend du boss), alors
-- que `Challenge` est une ligne **partagée** (`name`/`slug` uniques : « Spécial », `slug` `sp-cial`).
-- On stocke donc le texte sur la ligne du succès, exactement comme `imageUrl` porte déjà son icône.
-- Générée à la main (même raison que 20261231000000_market_wanted : `migrate dev` est bloqué par la
-- migration pré-existante cassée `20261010000000_add_component_stats`, hors périmètre).
ALTER TABLE "DungeonAchievement" ADD COLUMN IF NOT EXISTS "description" TEXT;
