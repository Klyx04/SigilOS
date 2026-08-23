-- AlterTable
ALTER TABLE "OptimizedGuide" ADD COLUMN     "displayMode" TEXT NOT NULL DEFAULT 'TREE',
ADD COLUMN     "isUnderConstruction" BOOLEAN NOT NULL DEFAULT false;
