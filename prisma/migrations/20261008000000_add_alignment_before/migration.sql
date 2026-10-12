-- Ajout du champ `alignmentBefore` (base d'alignement mémorisée avant le rush).
ALTER TABLE "UserProfile" ADD COLUMN "alignmentBefore" JSONB;
