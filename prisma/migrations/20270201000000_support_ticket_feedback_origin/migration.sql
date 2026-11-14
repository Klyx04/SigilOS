-- Fusion des signalements (`SystemIssue`) dans `SupportTicket` — étape additive.
--
-- ① `TicketOrigin` distingue un ticket Discord support d'un signalement membre
--    (`FEEDBACK`) ou d'une note interne God (`INTERNAL`) ;
-- ② `publicRef` conserve les liens historiques `SIG-<n>` et sert de référence
--    publique stable (jamais l'id interne dans une URL) ;
-- ③ `legacySystemIssueId` rend le backfill idempotent ;
-- ④ `discordGuildId` devient nullable : une note interne n'a pas de serveur.
--
-- Aucune donnée n'est copiée ni supprimée ici : le script
-- `scripts/migrate-system-issues-to-support-tickets.ts` s'en charge, à froid.
-- Migration additive et rejouable (`IF NOT EXISTS`).

DO $$
BEGIN
    CREATE TYPE "TicketOrigin" AS ENUM ('SUPPORT', 'FEEDBACK', 'INTERNAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "SupportTicket"
    ADD COLUMN IF NOT EXISTS "origin" "TicketOrigin" NOT NULL DEFAULT 'SUPPORT',
    ADD COLUMN IF NOT EXISTS "publicRef" TEXT,
    ADD COLUMN IF NOT EXISTS "legacySystemIssueId" INTEGER,
    ADD COLUMN IF NOT EXISTS "creatorUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "feedbackType" TEXT,
    ADD COLUMN IF NOT EXISTS "sourcePage" TEXT,
    ADD COLUMN IF NOT EXISTS "targetSlug" TEXT,
    ADD COLUMN IF NOT EXISTS "guildId" TEXT,
    ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
    ADD COLUMN IF NOT EXISTS "memberGuildName" TEXT,
    ADD COLUMN IF NOT EXISTS "priority" TEXT,
    ADD COLUMN IF NOT EXISTS "trackerStatus" "SystemIssueStatus",
    ADD COLUMN IF NOT EXISTS "forumLink" TEXT;

ALTER TABLE "SupportTicket" ALTER COLUMN "discordGuildId" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_publicRef_key"
    ON "SupportTicket" ("publicRef");

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_legacySystemIssueId_key"
    ON "SupportTicket" ("legacySystemIssueId");

CREATE INDEX IF NOT EXISTS "SupportTicket_origin_idx" ON "SupportTicket" ("origin");
CREATE INDEX IF NOT EXISTS "SupportTicket_feedbackType_idx" ON "SupportTicket" ("feedbackType");
CREATE INDEX IF NOT EXISTS "SupportTicket_guildId_idx" ON "SupportTicket" ("guildId");
CREATE INDEX IF NOT EXISTS "SupportTicket_trackerStatus_idx" ON "SupportTicket" ("trackerStatus");
CREATE INDEX IF NOT EXISTS "SupportTicket_createdAt_idx" ON "SupportTicket" ("createdAt");
