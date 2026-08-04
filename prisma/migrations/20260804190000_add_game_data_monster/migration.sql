-- CreateTable
CREATE TABLE "GameDataMonster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "zone" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameDataMonster_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GameDataMonster_name_idx" ON "GameDataMonster"("name");
CREATE INDEX "GameDataMonster_level_idx" ON "GameDataMonster"("level");