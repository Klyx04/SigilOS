-- Chantier Défi — fenêtre d'événement.
-- Un défi peut être dispo en permanence (`isPermanent` = true, défaut) ou borné dans le temps
-- (startDate = début de l'événement, endDate = fin). Si startDate/endDate sont NULL, l'événement
-- est considéré comme non daté (permanent à défaut).
ALTER TABLE "Defi" ADD COLUMN "isPermanent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Defi" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Defi" ADD COLUMN "endDate" TIMESTAMP(3);
