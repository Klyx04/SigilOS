-- CreateTable
CREATE TABLE "DreamBonus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ACTIF',
    "description" TEXT,
    "imageUrl" TEXT,
    "costMin" INTEGER,
    "costMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DreamBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameQuest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dofusDbId" INTEGER,
    "levelMin" INTEGER,
    "levelMax" INTEGER,
    "description" TEXT,
    "imageUrl" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameQuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DreamBonus_name_key" ON "DreamBonus"("name");

-- CreateIndex
CREATE INDEX "DreamBonus_type_idx" ON "DreamBonus"("type");

-- CreateIndex
CREATE UNIQUE INDEX "GameQuest_name_key" ON "GameQuest"("name");

-- CreateIndex
CREATE INDEX "GameQuest_category_idx" ON "GameQuest"("category");
