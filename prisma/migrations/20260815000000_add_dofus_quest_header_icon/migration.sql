-- Chantier #68 : choix God de l'icône du bloc d'en-tête des pages quêtes par Dofus
-- ("serie-de-quete" | "icone-succes"), avec traçage (qui / quand).

ALTER TABLE "PlatformConfig" ADD COLUMN "dofusQuestHeaderIcon" TEXT NOT NULL DEFAULT 'serie-de-quete';
ALTER TABLE "PlatformConfig" ADD COLUMN "dofusQuestHeaderIconUpdatedAt" TIMESTAMP(3);
ALTER TABLE "PlatformConfig" ADD COLUMN "dofusQuestHeaderIconUpdatedBy" TEXT;
