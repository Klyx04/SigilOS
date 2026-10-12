-- AlterTable
-- Champs de suivi des rappels de nettoyage automatique des demandes de service inactives (statut PENDING).
-- Idempotent (drift beta : colonnes deja creees hors migrations) : rejouable sans erreur.
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "reminderCount" INTEGER NOT NULL DEFAULT 0;
