-- 20270205000000_add_changelog_notification_type
--
-- Pourquoi : les notifications de **compte** (rang 65, lot N2) ont besoin d'un
-- type dédié pour une publication de changelog. Aucune donnée n'est réécrite.
--
-- Additif et idempotent : `ADD VALUE IF NOT EXISTS` (PostgreSQL 9.6+), comme
-- les migrations d'enum du dépôt. Le type est global ; la boîte compte reste
-- portée par `Notification.guildId = null`.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHANGELOG_PUBLISHED';
