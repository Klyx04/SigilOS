-- Route d'alignement du Rush Sylvestre (migration ADDITIVE, aucune perte de données).
--
-- Deux étages : la cité (`alignReq`, déjà présente), puis l'Ordre (`alignOrderCode`),
-- et un VERROU de palier (`alignLevelReq` = 20 | 40 | 60 | 80 | 100).
-- `classReq` couvre les quêtes de classe du début du guide.
--
-- `alignOrderReq` (legacy) servait de seuil de niveau : il est conservé le temps de la
-- bascule, puis supprimé dans une migration ultérieure.

ALTER TABLE "GuideSequence"
  ADD COLUMN "alignOrderCode" TEXT,
  ADD COLUMN "alignLevelReq" INTEGER,
  ADD COLUMN "classReq" TEXT;
