-- ============================================================================
-- Avis de recherche cochables + coches par personnage (16/11/2026)
--
-- Pourquoi : les visiteurs (et les membres) doivent cocher « avis fait / pas fait »,
-- et une coche de succès/avis doit être rattachée au **personnage** (principal ou mule).
--
-- Contenu :
--  · `characterSlot` sur `PublicDungeonAchievement` et `UserDungeonAchievement`
--    (défaut `PRINCIPAL` : les lignes existantes restent sur le personnage principal,
--    aucune valeur réécrite) ;
--  · les deux tables d'avis `PublicBountyCompletion` / `UserBountyCompletion`
--    (profil, avis, personnage, date ; unique + index + cascades) ;
--  · l'unicité des coches passe de (profil, succès) à (profil, succès, personnage).
--
-- Écrite à la main : ce dépôt n'utilise pas `migrate dev` (base locale en drift,
-- cf. docs/agents/prisma-schema-change.md §0). Aucune donnée supprimée ; les index
-- mono-colonne remplacés par les index composites sont retirés (redondants).
-- ============================================================================

-- 1. Coches par personnage (données existantes = personnage principal)
ALTER TABLE "PublicDungeonAchievement"
    ADD COLUMN IF NOT EXISTS "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL';
ALTER TABLE "UserDungeonAchievement"
    ADD COLUMN IF NOT EXISTS "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL';

-- 2. Unicité (profil, succès) → (profil, succès, personnage)
DROP INDEX IF EXISTS "PublicDungeonAchievement_publicProfileId_dungeonAchievementId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PublicDungeonAchievement_publicProfileId_dungeonAchievementId_characterSlot_key"
    ON "PublicDungeonAchievement"("publicProfileId", "dungeonAchievementId", "characterSlot");
-- L'index mono-colonne est couvert par le préfixe du composite.
DROP INDEX IF EXISTS "PublicDungeonAchievement_publicProfileId_idx";
CREATE INDEX IF NOT EXISTS "PublicDungeonAchievement_publicProfileId_characterSlot_idx"
    ON "PublicDungeonAchievement"("publicProfileId", "characterSlot");

DROP INDEX IF EXISTS "UserDungeonAchievement_userId_dungeonAchievementId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "UserDungeonAchievement_userId_dungeonAchievementId_characterSlot_key"
    ON "UserDungeonAchievement"("userId", "dungeonAchievementId", "characterSlot");
DROP INDEX IF EXISTS "UserDungeonAchievement_userId_idx";
CREATE INDEX IF NOT EXISTS "UserDungeonAchievement_userId_characterSlot_idx"
    ON "UserDungeonAchievement"("userId", "characterSlot");

-- 3. Avis de recherche — côté visiteur
CREATE TABLE IF NOT EXISTS "PublicBountyCompletion" (
    "id" TEXT NOT NULL,
    "publicProfileId" TEXT NOT NULL,
    "bountyId" TEXT NOT NULL,
    "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicBountyCompletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PublicBountyCompletion_publicProfileId_bountyId_characterSlot_key"
    ON "PublicBountyCompletion"("publicProfileId", "bountyId", "characterSlot");
CREATE INDEX IF NOT EXISTS "PublicBountyCompletion_publicProfileId_characterSlot_idx"
    ON "PublicBountyCompletion"("publicProfileId", "characterSlot");
CREATE INDEX IF NOT EXISTS "PublicBountyCompletion_bountyId_idx"
    ON "PublicBountyCompletion"("bountyId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PublicBountyCompletion_publicProfileId_fkey') THEN
        ALTER TABLE "PublicBountyCompletion"
            ADD CONSTRAINT "PublicBountyCompletion_publicProfileId_fkey"
            FOREIGN KEY ("publicProfileId") REFERENCES "PublicProfile"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PublicBountyCompletion_bountyId_fkey') THEN
        ALTER TABLE "PublicBountyCompletion"
            ADD CONSTRAINT "PublicBountyCompletion_bountyId_fkey"
            FOREIGN KEY ("bountyId") REFERENCES "Bounty"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Avis de recherche — côté membre (miroir interne)
CREATE TABLE IF NOT EXISTS "UserBountyCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bountyId" TEXT NOT NULL,
    "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBountyCompletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserBountyCompletion_userId_bountyId_characterSlot_key"
    ON "UserBountyCompletion"("userId", "bountyId", "characterSlot");
CREATE INDEX IF NOT EXISTS "UserBountyCompletion_userId_characterSlot_idx"
    ON "UserBountyCompletion"("userId", "characterSlot");
CREATE INDEX IF NOT EXISTS "UserBountyCompletion_bountyId_idx"
    ON "UserBountyCompletion"("bountyId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBountyCompletion_userId_fkey') THEN
        ALTER TABLE "UserBountyCompletion"
            ADD CONSTRAINT "UserBountyCompletion_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "UserProfile"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBountyCompletion_bountyId_fkey') THEN
        ALTER TABLE "UserBountyCompletion"
            ADD CONSTRAINT "UserBountyCompletion_bountyId_fkey"
            FOREIGN KEY ("bountyId") REFERENCES "Bounty"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
