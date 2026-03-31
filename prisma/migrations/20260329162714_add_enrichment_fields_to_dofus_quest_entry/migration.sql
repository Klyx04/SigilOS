-- AlterTable
ALTER TABLE "DofusQuestEntry" ADD COLUMN     "isDungeon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemsRequired" JSONB,
ADD COLUMN     "level" INTEGER,
ADD COLUMN     "npcSubArea" TEXT;
