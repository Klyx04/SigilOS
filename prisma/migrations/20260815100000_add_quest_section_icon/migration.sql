-- Chantier : choix d''icône de section (serie-de-quete | icone-succes) pour les blocs de quêtes Dofus
ALTER TABLE "DofusQuestChain" ADD COLUMN "sectionIcon" TEXT NOT NULL DEFAULT 'serie-de-quete';