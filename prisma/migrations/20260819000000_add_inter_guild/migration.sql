-- Chantier Inter-Guilde (19/08) : ouverture inter-guilde par guilde + anticipation contrôle God.
-- Opt-in fail-closed : interGuildEnabled = false par défaut (aucune guilde ouverte sans action explicite).
-- Le kill-switch God interGuildGlobalEnabled = true par défaut (n'expose rien seul : il faut
-- DE PLUS l'activation côté guilde — opt-in bilatéral).

ALTER TABLE "GuildConfig" ADD COLUMN "interGuildEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GuildConfig" ADD COLUMN "interGuildModules" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "PlatformConfig" ADD COLUMN "interGuildGlobalEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformConfig" ADD COLUMN "interGuildModules" JSONB;
ALTER TABLE "PlatformConfig" ADD COLUMN "interGuildChannels" JSONB;
