-- Chantier God Stockage (17/08) : seuil de stockage personnalisé par guilde.
-- `storageLimitBytes` = limite en octets ; NULL = défaut global appliqué côté code.
-- Dépassement → alerte God (notifyGod) + badge de statut dans le panel Stockage.
ALTER TABLE "GuildConfig" ADD COLUMN "storageLimitBytes" BIGINT;