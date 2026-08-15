-- Refonte éditeur quêtes façon Rush Sylvestre : positions de lancement + liens DofusDB / DofusNoobs
ALTER TABLE "DofusQuestEntry" ADD COLUMN "positions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "DofusQuestEntry" ADD COLUMN "dofusdbUrl" TEXT;
ALTER TABLE "DofusQuestEntry" ADD COLUMN "dofuspourlesnoobsUrl" TEXT;