-- 📋 Registre : essai Oui/Non (fini les étiquettes) + réglages par commande slash.
-- Additive et rejouable : aucune donnée supprimée (`lifecycleStatus` est conservée
-- mais n'est plus lue par le nouveau code).
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "trialValidated" BOOLEAN NOT NULL DEFAULT false;

-- Reprise : les essais déjà validés restent validés.
UPDATE "UserProfile" SET "trialValidated" = true WHERE "lifecycleStatus" = 'CONFIRMED';

-- Réglages propres à chaque commande slash (ex. rôles +/− par défaut de /valider-recrue).
ALTER TABLE "GuildSlashCommandPermission" ADD COLUMN IF NOT EXISTS "config" JSONB;
