-- 🎫 Tickets — plafonds plateforme (God) : rétention, transcripts, quotas max.
--
-- Constat : les transcripts HTML (2 docs par ticket) + notes + audit vivent en
-- Postgres, `expiresAt` est écrit mais **rien ne purge** ⇒ la base grossit sans
-- limite sur le VPS. Les durées étaient réglables par guilde (jusqu'à 3 650 j).
--
-- Décision user (28/09/2026) : c'est la plateforme (God) qui fixe les durées et
-- les plafonds ; les guildes gardent « Max tickets par membre » (plafonné),
-- la CSAT et l'on/off du module. Le janitor purge les expirés.
--
-- Migration **additive** : 6 colonnes avec défauts sûrs (90/90/180 j, caps 5/100),
-- aucune donnée touchée, aucun renommage. Convention du dépôt : `IF NOT EXISTS`
-- (rejouable sur une base partiellement à jour).

ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "ticketTranscriptsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "ticketRetentionArchivesDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "ticketRetentionNotesDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "ticketRetentionAuditDays" INTEGER NOT NULL DEFAULT 180;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "ticketMaxPerUserCap" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "ticketMaxGuildCap" INTEGER NOT NULL DEFAULT 100;
