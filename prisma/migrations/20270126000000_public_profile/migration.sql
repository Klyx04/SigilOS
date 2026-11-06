-- Espace visiteur (rang 57) — profil public, progression, métiers, succès (06/11/2026).
--
-- POURQUOI
--  · `signIn` refuse aujourd'hui tout compte Discord sans guilde gérée (`src/auth.ts`,
--    `NO_MANAGED_GUILD`) : un visiteur ne peut pas entrer. Sa progression vit donc dans le
--    navigateur (`src/lib/guest-progress.ts`) et n'est ni communautaire, ni sauvegardée.
--  · `UserProfile` est cloisonné par guilde (`guildId` obligatoire, `@@unique([userId, guildId])`)
--    et `UserDungeonAchievement` pointe `UserProfile` : aucune de ces tables ne peut servir
--    un visiteur sans lui fabriquer une guilde. D'où des tables **dédiées** (D-V1).
--
-- CONTENU : quatre tables additives, aucune donnée existante réécrite.
--   · PublicProfile            — profil public, `dofusServerId` OBLIGATOIRE (clé du ladder)
--   · PublicRushProgress       — progression par (profil, guide, personnage)
--   · PublicProfession         — métiers normalisés (filtre SQL de l'annuaire)
--   · PublicDungeonAchievement — succès cochés, hors profil de guilde
--
-- Écrite à la main : `prisma migrate dev` est inutilisable sur cet historique local (base en
-- drift, cf. docs/agents/prisma-schema-change.md §0). Additive et idempotente.

CREATE TABLE IF NOT EXISTS "PublicProfile" (
    "id"                   TEXT NOT NULL,
    "userId"               TEXT NOT NULL,
    "dofusServerId"        INTEGER NOT NULL,
    "pseudoDofus"          TEXT,
    "classe"               TEXT,
    "declaredGuildName"    TEXT,
    "declaredGuildLogoUrl" TEXT,
    "introduction"         TEXT,
    "objectifs"            TEXT,
    "preferredActivities"  JSONB,
    "metiers"              JSONB,
    "metamobPseudo"        TEXT,
    "metamobApiKey"        TEXT,
    "metamobVerified"      BOOLEAN NOT NULL DEFAULT false,
    "alignment"            TEXT,
    "alignmentOrder"       TEXT,
    "alignmentLevel"       INTEGER NOT NULL DEFAULT 0,
    "dofusLevel"           INTEGER,
    "totalXp"              BIGINT DEFAULT 0,
    "successPoints"        INTEGER DEFAULT 0,
    "lastLadderSync"       TIMESTAMP(3),
    "showOnDirectory"      BOOLEAN NOT NULL DEFAULT false,
    "showPresence"         BOOLEAN NOT NULL DEFAULT false,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicProfile_userId_key"
    ON "PublicProfile"("userId");

CREATE INDEX IF NOT EXISTS "PublicProfile_dofusServerId_showOnDirectory_idx"
    ON "PublicProfile"("dofusServerId", "showOnDirectory");

CREATE INDEX IF NOT EXISTS "PublicProfile_lastLadderSync_idx"
    ON "PublicProfile"("lastLadderSync");

CREATE TABLE IF NOT EXISTS "PublicRushProgress" (
    "id"                  TEXT NOT NULL,
    "publicProfileId"     TEXT NOT NULL,
    "guideId"             TEXT NOT NULL,
    "characterSlot"       INTEGER NOT NULL DEFAULT 0,
    "characterName"       TEXT,
    "classe"              TEXT,
    "completedMilestones" JSONB,
    "completedSteps"      JSONB,
    "bookmarks"           JSONB,
    "dungeonChecks"       JSONB,
    "currentStep"         TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicRushProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicRushProgress_publicProfileId_guideId_characterSlot_key"
    ON "PublicRushProgress"("publicProfileId", "guideId", "characterSlot");

CREATE INDEX IF NOT EXISTS "PublicRushProgress_publicProfileId_idx"
    ON "PublicRushProgress"("publicProfileId");

CREATE INDEX IF NOT EXISTS "PublicRushProgress_guideId_updatedAt_idx"
    ON "PublicRushProgress"("guideId", "updatedAt");

CREATE TABLE IF NOT EXISTS "PublicProfession" (
    "id"              TEXT NOT NULL,
    "publicProfileId" TEXT NOT NULL,
    "metierId"        INTEGER NOT NULL,
    "level"           INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PublicProfession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicProfession_publicProfileId_metierId_key"
    ON "PublicProfession"("publicProfileId", "metierId");

CREATE INDEX IF NOT EXISTS "PublicProfession_metierId_level_idx"
    ON "PublicProfession"("metierId", "level");

CREATE TABLE IF NOT EXISTS "PublicDungeonAchievement" (
    "id"                   TEXT NOT NULL,
    "publicProfileId"      TEXT NOT NULL,
    "dungeonAchievementId" TEXT NOT NULL,
    "completedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicDungeonAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicDungeonAchievement_publicProfileId_dungeonAchievementId_key"
    ON "PublicDungeonAchievement"("publicProfileId", "dungeonAchievementId");

CREATE INDEX IF NOT EXISTS "PublicDungeonAchievement_publicProfileId_idx"
    ON "PublicDungeonAchievement"("publicProfileId");

CREATE INDEX IF NOT EXISTS "PublicDungeonAchievement_dungeonAchievementId_idx"
    ON "PublicDungeonAchievement"("dungeonAchievementId");

-- Clés étrangères (posées une seule fois : PostgreSQL n'a pas de `ADD CONSTRAINT IF NOT EXISTS`
-- et `migrate deploy` peut rejouer le fichier après une interruption).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PublicProfile_userId_fkey'
    ) THEN
        ALTER TABLE "PublicProfile"
            ADD CONSTRAINT "PublicProfile_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PublicRushProgress_publicProfileId_fkey'
    ) THEN
        ALTER TABLE "PublicRushProgress"
            ADD CONSTRAINT "PublicRushProgress_publicProfileId_fkey"
            FOREIGN KEY ("publicProfileId") REFERENCES "PublicProfile"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PublicProfession_publicProfileId_fkey'
    ) THEN
        ALTER TABLE "PublicProfession"
            ADD CONSTRAINT "PublicProfession_publicProfileId_fkey"
            FOREIGN KEY ("publicProfileId") REFERENCES "PublicProfile"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PublicDungeonAchievement_publicProfileId_fkey'
    ) THEN
        ALTER TABLE "PublicDungeonAchievement"
            ADD CONSTRAINT "PublicDungeonAchievement_publicProfileId_fkey"
            FOREIGN KEY ("publicProfileId") REFERENCES "PublicProfile"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PublicDungeonAchievement_dungeonAchievementId_fkey'
    ) THEN
        ALTER TABLE "PublicDungeonAchievement"
            ADD CONSTRAINT "PublicDungeonAchievement_dungeonAchievementId_fkey"
            FOREIGN KEY ("dungeonAchievementId") REFERENCES "DungeonAchievement"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
