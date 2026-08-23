-- Chantier Disponibilités (18/08) : nouveau module « Disponibilités » activable par guilde.
-- Désactivé par défaut (opt-in) : les guildes existantes passent à false, l'admin active
-- explicitement via /admin/modules (le popup hebdo ne s'affiche jamais si module inactif).
ALTER TABLE "GuildModules" ADD COLUMN "availability" BOOLEAN NOT NULL DEFAULT false;
