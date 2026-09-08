-- Chantier Titan (Événement Krosmique, ex. Gargandyas)
-- 
-- Contenu ÉVOLUTIF : chaque Titan porte SA PROPRE config de disponibilité (jours/créneaux/maxVictoires),
-- ce qui permet d'ajouter de futurs Titans avec des contraintes différentes sans figer le modèle.
--
-- 1) Nouveau mode de recherche DJ : Titan
ALTER TYPE "DjSearchMode" ADD VALUE 'TITAN';

-- 2) Nouveau modèle Titan (boss de week-end, contenu évolutif)
CREATE TABLE "Titan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 200,
    "description" TEXT,
    "zone" TEXT,
    "imageUrl" TEXT,
    "dpnlUrl" TEXT,
    "dofensiveUrl" TEXT,
    "dofuspourlesnoobsUrl" TEXT,
    "mapName" TEXT,
    "dofusdbId" INTEGER,
    "scheduleConfig" JSONB NOT NULL DEFAULT '{}',
    "seasonBosses" JSONB NOT NULL DEFAULT '[]',
    "seasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "currentSeason" TEXT,
    "maxMembers" INTEGER NOT NULL DEFAULT 4,
    "isPermanent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Titan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Titan_slug_key" ON "Titan"("slug");
CREATE INDEX "Titan_name_idx" ON "Titan"("name");
CREATE INDEX "Titan_zone_idx" ON "Titan"("zone");
CREATE INDEX "Titan_level_idx" ON "Titan"("level");

-- 3) Progression « je l'ai vaincu » sur un titan (par membre)
CREATE TABLE "UserTitanProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "titanId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTitanProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserTitanProgress_profileId_titanId_key" ON "UserTitanProgress"("profileId", "titanId");
CREATE INDEX "UserTitanProgress_profileId_idx" ON "UserTitanProgress"("profileId");
CREATE INDEX "UserTitanProgress_titanId_idx" ON "UserTitanProgress"("titanId");
ALTER TABLE "UserTitanProgress" ADD CONSTRAINT "UserTitanProgress_titanId_fkey" FOREIGN KEY ("titanId") REFERENCES "Titan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTitanProgress" ADD CONSTRAINT "UserTitanProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) DjSearchPost : rattachement optionnel à un titan
ALTER TABLE "DjSearchPost" ADD COLUMN "titanId" TEXT;
ALTER TABLE "DjSearchPost" ADD COLUMN "titanName" TEXT;
ALTER TABLE "DjSearchPost" ADD CONSTRAINT "DjSearchPost_titanId_fkey" FOREIGN KEY ("titanId") REFERENCES "Titan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

