-- Nettoyage final de la fusion des signalements.
--
-- ⚠️ MIGRATION DESTRUCTIVE — à jouer **après** le backfill `SystemIssue` →
-- `SupportTicket` (dry-run puis apply, compteurs vérifiés) et après bascule du
-- code. `legacySystemIssueId` reste dans `SupportTicket` pour la traçabilité.
--
-- ① l'enum de suivi est renommé : `SystemIssueStatus` → `TrackerStatus`
--    (la colonne `SupportTicket.trackerStatus` suit automatiquement) ;
-- ② la table source et son enum de type sont supprimés.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SystemIssueStatus') THEN
        ALTER TYPE "SystemIssueStatus" RENAME TO "TrackerStatus";
    END IF;
END
$$;

DROP TABLE IF EXISTS "SystemIssue";
DROP TYPE IF EXISTS "SystemIssueType";
