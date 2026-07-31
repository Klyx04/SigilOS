-- AlterTable: étendre Archimonstre en catalogue de monstres Dofus (Quête Ocre + tous DofusDB)
-- Ajoute le flag isOcre, assouplit l'unicité (name,type) et indexe sur isOcre + dofusdbId

-- 1. Ajouter la colonne isOcre (défaut false = monstre du catalogue, true = Quête Ocre)
ALTER TABLE "Archimonstre" ADD COLUMN "isOcre" BOOLEAN NOT NULL DEFAULT false;

-- 2. Remplacer la contrainte unique sur name seul par une contrainte (name, type)
-- Les monstres normaux Dofus peuvent avoir des homonymes avec un type différent
DROP INDEX IF EXISTS "Archimonstre_name_key";
CREATE UNIQUE INDEX "Archimonstre_name_type_key" ON "Archimonstre"("name", "type");

-- 3. Index pour le filtre isOcre et la recherche par dofusdbId
CREATE INDEX "Archimonstre_isOcre_idx" ON "Archimonstre"("isOcre");
CREATE INDEX "Archimonstre_dofusdbId_idx" ON "Archimonstre"("dofusdbId");