-- Correction 13/09 (fidélité DofusDB) : sens d'affichage d'une ligne d'effet.
-- DofusDB expose `characteristicOperator` (« + » / « - ») et un gabarit de
-- description qui PORTE le signe (« -#1{{~1~2 à -}}#2 Esquive PA ») ; les dés
-- bruts d'un item (`possibleEffects`) sont toujours positifs ⇒ sans ces deux
-- colonnes, un malus s'affiche « +6 à +8 » au lieu de « -6 à -8 ».
-- Additif et idempotent : `isNegativeValue` a une valeur par défaut (false),
-- `characteristicOperator` est nullable → aucune ligne existante n'est touchée.
ALTER TABLE "GameEffect" ADD COLUMN IF NOT EXISTS "characteristicOperator" TEXT;
ALTER TABLE "GameEffect" ADD COLUMN IF NOT EXISTS "isNegativeValue" BOOLEAN NOT NULL DEFAULT false;
