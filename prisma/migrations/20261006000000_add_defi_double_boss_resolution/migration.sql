-- Chantier double boss & défi
-- 1) Dungeon : dissociation affichage / résolution Dofensive + flag « donjon sans succès »
ALTER TABLE "Dungeon" ADD COLUMN "dofensiveMonsterName" TEXT;
ALTER TABLE "Dungeon" ADD COLUMN "dofensiveDungeonName" TEXT;
ALTER TABLE "Dungeon" ADD COLUMN "isNoAchievement" BOOLEAN NOT NULL DEFAULT false;

-- 2) Nouveau modèle Defi (événement one-shot, un ou plusieurs boss)
CREATE TABLE "Defi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "zone" TEXT,
    "level" INTEGER,
    "imageUrl" TEXT,
    "dofensiveUrl" TEXT,
    "dpnlUrl" TEXT,
    "dofuspourlesnoobsUrl" TEXT,
    "bossNames" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Defi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Defi_slug_key" ON "Defi"("slug");
CREATE INDEX "Defi_name_idx" ON "Defi"("name");
CREATE INDEX "Defi_zone_idx" ON "Defi"("zone");
CREATE INDEX "Defi_level_idx" ON "Defi"("level");

-- 3) Progression « je l'ai fait » sur un défi (par membre)
CREATE TABLE "UserDefiProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "defiId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserDefiProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserDefiProgress_profileId_defiId_key" ON "UserDefiProgress"("profileId", "defiId");
CREATE INDEX "UserDefiProgress_profileId_idx" ON "UserDefiProgress"("profileId");
CREATE INDEX "UserDefiProgress_defiId_idx" ON "UserDefiProgress"("defiId");
ALTER TABLE "UserDefiProgress" ADD CONSTRAINT "UserDefiProgress_defiId_fkey" FOREIGN KEY ("defiId") REFERENCES "Defi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDefiProgress" ADD CONSTRAINT "UserDefiProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) DjSearchPost : rattachement optionnel à un défi
ALTER TABLE "DjSearchPost" ADD COLUMN "defiId" TEXT;
ALTER TABLE "DjSearchPost" ADD COLUMN "defiName" TEXT;
ALTER TABLE "DjSearchPost" ADD CONSTRAINT "DjSearchPost_defiId_fkey" FOREIGN KEY ("defiId") REFERENCES "Defi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Nouveau mode de recherche DJ : Défi
ALTER TYPE "DjSearchMode" ADD VALUE 'DEFI';
