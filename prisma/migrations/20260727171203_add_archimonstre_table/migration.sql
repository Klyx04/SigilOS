-- CreateTable
CREATE TABLE "Archimonstre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'archimonstre',
    "imageUrl" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "dofusdbId" INTEGER,
    "zone" TEXT,
    "subzone" TEXT,
    "subareaIds" JSONB NOT NULL DEFAULT '[]',
    "worldMapId" INTEGER NOT NULL DEFAULT 1,
    "centerX" DOUBLE PRECISION,
    "centerY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Archimonstre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Archimonstre_name_key" ON "Archimonstre"("name");

-- CreateIndex
CREATE INDEX "Archimonstre_name_idx" ON "Archimonstre"("name");

-- CreateIndex
CREATE INDEX "Archimonstre_type_idx" ON "Archimonstre"("type");
