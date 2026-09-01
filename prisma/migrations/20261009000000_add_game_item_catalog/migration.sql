-- CreateTable
CREATE TABLE "GameItem" (
    "id" TEXT NOT NULL,
    "ankamaId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "typeId" INTEGER,
    "typeName" TEXT NOT NULL DEFAULT 'Item',
    "category" TEXT NOT NULL DEFAULT 'equipment',
    "description" TEXT,
    "effects" JSONB,
    "recipe" JSONB,
    "hasRecipe" BOOLEAN NOT NULL DEFAULT false,
    "iconUrl" TEXT,
    "dataHash" TEXT,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameItem_ankamaId_key" ON "GameItem"("ankamaId");

-- CreateIndex
CREATE INDEX "GameItem_name_idx" ON "GameItem"("name");

-- CreateIndex
CREATE INDEX "GameItem_category_idx" ON "GameItem"("category");

-- CreateIndex
CREATE INDEX "GameItem_typeName_idx" ON "GameItem"("typeName");

-- CreateIndex
CREATE INDEX "GameItem_level_idx" ON "GameItem"("level");
