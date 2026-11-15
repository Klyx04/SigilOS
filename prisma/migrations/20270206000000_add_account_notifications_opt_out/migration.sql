-- 20270206000000_add_account_notifications_opt_out
--
-- Pourquoi : l'opt-out des notifications de **compte** (rang 65, N2-bis). Un
-- interrupteur dans `/espace-visiteur/reglages` coupe le fan-out changelog et
-- les réponses aux signalements, sans toucher aux notifications existantes.
--
-- Additif et idempotent : `ADD COLUMN IF NOT EXISTS`, défaut `true` pour ne pas
-- désactiver silencieusement les comptes existants.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "accountNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
