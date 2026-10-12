-- 📜 Contenu des quêtes : résumé canonique (FR borné) + empreinte + `updatedAt` DofusDB.
-- Additif (colonnes nullables) : aucune donnée touchée, les quêtes existantes restent valides.
-- Volume mesuré : ≈ 10 Ko par quête DofusDB (multilingue) mais le résumé stocké pèse ≈ 0,5-2 Ko
-- ⇒ ≈ 1-3 Mo pour les 1976 quêtes (jamais 20 Mo).

ALTER TABLE "GameQuest" ADD COLUMN IF NOT EXISTS "contentJson" JSONB;
ALTER TABLE "GameQuest" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "GameQuest" ADD COLUMN IF NOT EXISTS "dofusDbUpdatedAt" TIMESTAMP(3);
