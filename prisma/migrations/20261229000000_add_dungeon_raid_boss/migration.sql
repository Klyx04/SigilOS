-- 🐉 Boss de raid — catégorisation dans le référentiel des donjons (Game Data).
-- Ajout des colonnes `isRaidBoss` et `raidId` sur la table `Dungeon`.

ALTER TABLE "Dungeon" ADD COLUMN IF NOT EXISTS "isRaidBoss" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dungeon" ADD COLUMN IF NOT EXISTS "raidId" TEXT;

CREATE INDEX IF NOT EXISTS "Dungeon_isRaidBoss_idx" ON "Dungeon"("isRaidBoss");
