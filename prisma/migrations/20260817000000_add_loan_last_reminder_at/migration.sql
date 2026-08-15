-- Chantier #71 (résiduel) : rappel automatique des prêts non clos.
-- `lastReminderAt` → idempotence anti-spam : le cron ne re-ping qu'une fois
-- par cooldown (24h) par prêt, et ne re-ping jamais un prêt déjà clôturé.
ALTER TABLE "GuildLoan" ADD COLUMN "lastReminderAt" TIMESTAMP(3);