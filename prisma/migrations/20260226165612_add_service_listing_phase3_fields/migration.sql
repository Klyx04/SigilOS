-- AlterTable
ALTER TABLE "ServiceListing" ADD COLUMN     "craftMeta" JSONB,
ADD COLUMN     "dofusItemAnkamaId" INTEGER,
ADD COLUMN     "dofusItemIconUrl" TEXT,
ADD COLUMN     "dofusItemName" TEXT,
ADD COLUMN     "dungeonId" TEXT,
ADD COLUMN     "dungeonName" TEXT,
ADD COLUMN     "priceTiers" JSONB,
ADD COLUMN     "professions" JSONB,
ADD COLUMN     "questId" TEXT,
ADD COLUMN     "questName" TEXT,
ADD COLUMN     "selectedAchievements" JSONB;
