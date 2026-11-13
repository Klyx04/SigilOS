-- Limite de guildes par utilisateur (`docs/plans/PLAN-LIMITE-GUILDES.md`, LG-1).
--
-- Pourquoi : la plateforme n'avait **aucun** plafond de guildes par utilisateur (mesure du
-- 31/10/2026 : `maxMembers` par guilde existe, `maxGuildsPerUser` nulle part). Le seuil vit en
-- configuration pour rester réglable sans redéploiement, mais il est **borné 1..10** à la lecture
-- (`src/lib/guild-limit.ts`) : un 0 refuserait même la première guilde.
--
-- Contenu : une seule colonne additive, avec défaut. Aucune donnée réécrite — les plateformes
-- existantes passent donc automatiquement à 2.
--
-- Écrite à la main : `prisma migrate dev` est inutilisable sur cet historique (base locale en
-- drift, cf. `docs/agents/prisma-schema-change.md` §0). Additive et idempotente.

ALTER TABLE "PlatformConfig"
    ADD COLUMN IF NOT EXISTS "maxGuildsPerUser" INTEGER NOT NULL DEFAULT 2;
