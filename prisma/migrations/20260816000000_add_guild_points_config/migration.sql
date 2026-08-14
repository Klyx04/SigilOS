-- Chantier : points de contribution personnalisables par les admins de guilde
-- (DJ / quêtes / Songes). JSON stocké sur GuildConfig, lu à la clôture des runs/posts.

ALTER TABLE "GuildConfig" ADD COLUMN "pointsConfig" JSONB;
