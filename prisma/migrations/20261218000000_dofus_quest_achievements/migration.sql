/*
  Quêtes Dofus — succès imbriqués (18/09/2026)

  Un succès du jeu contient soit une série de quêtes, soit une série de succès
  imbriqués (« Le pays des Vermeils » → « Même pas malle » → ses quêtes).
  Deux colonnes suffisent, sur l'entrée existante :

  - `entryKind`     : QUEST (défaut, comportement historique) | ACHIEVEMENT (conteneur)
  - `parentEntryId` : id du succès parent (NULL = entrée à la racine de sa section)

  Pas de clé étrangère : une section est purgée en bloc au re-seed
  (`DofusQuestEntry.deleteMany({ where: { chainId } })`), et les Server Actions God
  garantissent déjà « même section + anti-cycle + cascade à la suppression ».

  `IF NOT EXISTS` : idempotent, même esprit que les migrations ADD COLUMN IF NOT EXISTS
  de la PR #614.
*/
-- AlterTable
ALTER TABLE "DofusQuestEntry" ADD COLUMN IF NOT EXISTS "entryKind" TEXT NOT NULL DEFAULT 'QUEST';

-- AlterTable
ALTER TABLE "DofusQuestEntry" ADD COLUMN IF NOT EXISTS "parentEntryId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DofusQuestEntry_parentEntryId_idx" ON "DofusQuestEntry"("parentEntryId");
