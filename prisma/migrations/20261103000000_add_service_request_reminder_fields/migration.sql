-- AlterTable
-- Champs de suivi des rappels de nettoyage automatique des demandes de service inactives (statut PENDING).
ALTER TABLE "ServiceRequest" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "ServiceRequest" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
