-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "ocreProgressSnapshot" JSONB;

-- CreateTable
CREATE TABLE "OcreMonsterTemplate" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "image" TEXT,
    "levelMin" INTEGER NOT NULL DEFAULT 0,
    "levelMax" INTEGER NOT NULL DEFAULT 0,
    "zones" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcreMonsterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcreMonsterTemplate_type_idx" ON "OcreMonsterTemplate"("type");

-- CreateIndex
CREATE INDEX "OcreMonsterTemplate_name_idx" ON "OcreMonsterTemplate"("name");
