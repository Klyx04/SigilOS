-- Légalité des variantes : **conditions d'équipement** et **armes à deux mains**.
--
-- Pourquoi : la validation d'une variante (`saveBuildVariant`) doit refuser un objet dont la
-- condition n'est pas remplie (« PA < 12 ou PM < 6 » du Heaume Oplate, « Bonus de panoplies < 2 »
-- du Dévastateur Feu majeur) et une arme à deux mains portée avec un bouclier. Ces deux
-- informations existent dans l'API DofusDB (`items.criterions`, `items.twoHanded`) mais
-- n'étaient pas stockées.
--
-- Migration **ADDITIVE** : deux colonnes vides avec valeur par défaut, aucune ligne réécrite,
-- aucun index (les valeurs sont lues à l'unité, par `ankamaId`, pendant la validation).
-- Écrite à la main : `migrate dev` est inutilisable sur cet historique
-- (cf. `docs/agents/prisma-schema-change.md` §0).
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "criterions" TEXT;
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "twoHanded" BOOLEAN NOT NULL DEFAULT false;
