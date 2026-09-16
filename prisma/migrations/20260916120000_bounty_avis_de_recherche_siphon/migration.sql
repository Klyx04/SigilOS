-- Chantier « Avis de recherche » (Lot 1) — fiche/siphon des 96 avis (DofusDB + Dofensive).
--
-- Additif et idempotent. Deux points de conception :
--   1. `name` perd son unicité : 3 avis homonymes existent (« Ronce » 3530/3555 + « Ronce
--      animée » 3531) — l'upsert du siphon se fait sur `dofusdbId` (clé métier Ankama).
--      Selon l'historique de la base, l'unicité est portée par une CONTRAINTE ou par un
--      INDEX unique : on retire les deux (mesuré sur la base locale : index `Bounty_name_key`).
--   2. `isBountyMonster` marque les avis SIPHONNÉS : les lignes historiques de la table
--      (archimonstres/boss utilisés par la carte du monde) restent à `false` et ne sont
--      jamais servies comme avis par les écrans.

ALTER TABLE "Bounty" DROP CONSTRAINT IF EXISTS "Bounty_name_key";
DROP INDEX IF EXISTS "Bounty_name_key";

ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "dofusdbId" INTEGER;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "raceId" INTEGER;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "raceName" TEXT;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "subareaIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "isBountyMonster" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "battleMapId" INTEGER;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "battleMapSource" TEXT;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "dofusdbSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Bounty_dofusdbId_key" ON "Bounty"("dofusdbId");
CREATE INDEX IF NOT EXISTS "Bounty_isBountyMonster_idx" ON "Bounty"("isBountyMonster");

ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "raceId" INTEGER;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "raceName" TEXT;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "subareaIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "isBountyMonster" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "battleMapId" INTEGER;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "battleMapSource" TEXT;
ALTER TABLE "Bounty" ADD COLUMN IF NOT EXISTS "dofusdbSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Bounty_dofusdbId_key" ON "Bounty"("dofusdbId");
CREATE INDEX IF NOT EXISTS "Bounty_isBountyMonster_idx" ON "Bounty"("isBountyMonster");
