-- Embed « fin d'essai » : salon de guilde dédié (demande user du 25/10/2026).
--
-- Contenu : une seule colonne additive, `trialEndNotifyChannelId`. Quand un essai
-- arrive à échéance sans être validé, le cron `sync-members` publie UN embed dans ce
-- salon (idempotence assurée par une clé Redis par membre + échéance : aucune colonne
-- supplémentaire, aucune donnée réécrite).
--
-- Vide ⇒ aucune notification (fail-closed : on n'écrit pas dans un salon non choisi).
--
-- Écrite à la main (cf. `docs/agents/prisma-schema-change.md` §0 : `migrate dev` est
-- inutilisable sur cet historique local).

ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "trialEndNotifyChannelId" TEXT;
