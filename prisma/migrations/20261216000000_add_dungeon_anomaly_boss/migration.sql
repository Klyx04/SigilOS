-- Chantier « boss d'anomalie » (Gardiens des anomalies temporelles).
--
-- Les gardiens (DofusDB race 191 « Gardiens des anomalies », 16 entités dont Qilby 8131)
-- sont siphonnés par le cron `sync-monster-stats` : une ligne `Dungeon` par gardien boss
-- (name = carte de combat, bossName = gardien), marquée `isAnomalyBoss` + `isNoAchievement`
-- (le « succès » est d'être validé → pseudo-succès « Donjon validé »), donc visible dans
-- « Mes Succès », les fiches boss et l'overlay Bestiaire.
--
-- Migration ADDITIVE uniquement (aucune donnée existante touchée, aucun backfill nécessaire).

ALTER TABLE "Dungeon" ADD COLUMN "isAnomalyBoss" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dungeon" ADD COLUMN "anomalyMapId" INTEGER;
ALTER TABLE "Dungeon" ADD COLUMN "anomalyFamily" TEXT;

CREATE INDEX "Dungeon_isAnomalyBoss_idx" ON "Dungeon"("isAnomalyBoss");
