-- ============================================================================
-- Tracker interne — coches de succès par personnage (16/11/2026)
--
-- Pourquoi : le module « Mes Succès » écrit `UserDungeonProgress` ; une coche doit
-- pouvoir viser le personnage principal ou une mule déclarée, comme côté visiteur.
--
-- Contenu : colonne `characterSlot` (défaut `PRINCIPAL`, aucune valeur réécrite),
-- unicité (profil, succès) → (profil, succès, personnage), index composite.
-- Aucune table supprimée, aucune donnée modifiée.
--
-- Écrite à la main (ce dépôt n'utilise pas `migrate dev`, cf.
-- docs/agents/prisma-schema-change.md §0).
-- ============================================================================

ALTER TABLE "UserDungeonProgress"
    ADD COLUMN IF NOT EXISTS "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL';

DROP INDEX IF EXISTS "UserDungeonProgress_profileId_achievementId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "UserDungeonProgress_profileId_achievementId_characterSlot_key"
    ON "UserDungeonProgress"("profileId", "achievementId", "characterSlot");

-- L'index mono-colonne est couvert par le préfixe du composite.
DROP INDEX IF EXISTS "UserDungeonProgress_profileId_idx";
CREATE INDEX IF NOT EXISTS "UserDungeonProgress_profileId_characterSlot_idx"
    ON "UserDungeonProgress"("profileId", "characterSlot");
