-- 🎫 Tickets v2 — refonte du module : parcours, formulaires versionnés, équipes, archive séparée.
--
-- Migration **additive** : aucune donnée n'est supprimée, aucun renommage destructif.
-- Les objets v1 restent lisibles (`TicketBotCategory`, `TicketBotPanel.categoryIds`,
-- `TicketRecord.categoryId`) : un ticket déjà ouvert garde sa catégorie et son panneau.
-- Écrite depuis le datamodel puis re-vérifiée par `prisma migrate diff` (le diff résiduel
-- ne contient plus aucun énoncé `Ticket*`), avec les gardes `IF NOT EXISTS` de la
-- convention du dépôt : rejouée à la main sur une base partiellement à jour, elle ne casse pas.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TicketFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TicketOpenMode" AS ENUM ('INSTANT', 'APPROVAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TicketClosePolicy" AS ENUM ('STAFF_ONLY', 'STAFF_OR_CREATOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TicketArchiveKind" AS ENUM ('SHAREABLE', 'INTERNAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum — valeurs ajoutées en fin d'énumération (jamais utilisées dans cette migration)
ALTER TYPE "TicketBotStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "TicketBotStatus" ADD VALUE IF NOT EXISTS 'ARCHIVE_FAILED';
ALTER TYPE "TicketBotStatus" ADD VALUE IF NOT EXISTS 'REFUSED';

-- AlterTable — 🆕 v2 : parcours exposés par un panneau Discord déployé
ALTER TABLE "TicketBotPanel" ADD COLUMN IF NOT EXISTS "journeyIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable — 🆕 v2 : rétention par type de donnée (0 = illimité, consommée par la purge)
ALTER TABLE "TicketGuildConfig" ADD COLUMN IF NOT EXISTS "transcriptRetentionDays" INTEGER NOT NULL DEFAULT 365;
ALTER TABLE "TicketGuildConfig" ADD COLUMN IF NOT EXISTS "noteRetentionDays" INTEGER NOT NULL DEFAULT 365;
ALTER TABLE "TicketGuildConfig" ADD COLUMN IF NOT EXISTS "auditRetentionDays" INTEGER NOT NULL DEFAULT 730;

-- AlterTable — 🆕 v2 : parcours figé, file d'approbation, étiquettes, priorité
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "journeyId" TEXT;
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "formVersionId" TEXT;
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "approvedByDiscordId" TEXT;
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "refusedByDiscordId" TEXT;
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "refusedAt" TIMESTAMP(3);
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "refusalReason" TEXT;
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TicketRecord" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
-- Un ticket v2 n'a pas de catégorie : le parcours prend sa place.
ALTER TABLE "TicketRecord" ALTER COLUMN "categoryId" DROP NOT NULL;

-- AlterTable — 🆕 v2 : archive honnête (nature, complétude, expiration, accès)
ALTER TABLE "TicketTranscript" ADD COLUMN IF NOT EXISTS "kind" "TicketArchiveKind" NOT NULL DEFAULT 'SHAREABLE';
ALTER TABLE "TicketTranscript" ADD COLUMN IF NOT EXISTS "totalCount" INTEGER;
ALTER TABLE "TicketTranscript" ADD COLUMN IF NOT EXISTS "partial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TicketTranscript" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "TicketTranscript" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "TicketTranscript" ADD COLUMN IF NOT EXISTS "accessCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TicketTranscript" ADD COLUMN IF NOT EXISTS "lastAccessedAt" TIMESTAMP(3);

-- DropIndex — un ticket porte désormais jusqu'à DEUX archives (partageable + interne)
DROP INDEX IF EXISTS "TicketTranscript_ticketId_key";

-- CreateTable — 🆕 équipe répondante réutilisable
CREATE TABLE IF NOT EXISTS "TicketTeam" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifyRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable — 🆕 formulaire réutilisable (brouillon + version publiée)
CREATE TABLE IF NOT EXISTS "TicketForm" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "TicketFormStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedVersion" INTEGER,
    "draftSchemaJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable — 🆕 version figée d'un formulaire
CREATE TABLE IF NOT EXISTS "TicketFormVersion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schemaJson" JSONB NOT NULL,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketFormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable — 🆕 le parcours (unité éditable du produit)
CREATE TABLE IF NOT EXISTS "TicketJourney" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🎫',
    "buttonStyle" "TicketButtonStyle" NOT NULL DEFAULT 'PRIMARY',
    "channelType" "TicketChannelType" NOT NULL DEFAULT 'CHANNEL_TEXT',
    "channelParentId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teamId" TEXT,
    "formId" TEXT,
    "formVersion" INTEGER,
    "namingPattern" TEXT NOT NULL DEFAULT 'ticket-{num}',
    "openMode" "TicketOpenMode" NOT NULL DEFAULT 'INSTANT',
    "closePolicy" "TicketClosePolicy" NOT NULL DEFAULT 'STAFF_ONLY',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable — 🆕 brouillon d'ouverture (choix avant la modale, TTL court)
CREATE TABLE IF NOT EXISTS "TicketDraft" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "formVersionId" TEXT,
    "discordUserId" TEXT NOT NULL,
    "answersJson" JSONB NOT NULL DEFAULT '{}',
    "step" TEXT NOT NULL DEFAULT 'CHOICES',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketDraft_guildId_expiresAt_idx" ON "TicketDraft"("guildId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TicketDraft_guildId_journeyId_discordUserId_key" ON "TicketDraft"("guildId", "journeyId", "discordUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketTeam_guildId_isEnabled_idx" ON "TicketTeam"("guildId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TicketTeam_guildId_slug_key" ON "TicketTeam"("guildId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketForm_guildId_status_idx" ON "TicketForm"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TicketForm_guildId_slug_key" ON "TicketForm"("guildId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketFormVersion_guildId_idx" ON "TicketFormVersion"("guildId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketFormVersion_formId_createdAt_idx" ON "TicketFormVersion"("formId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TicketFormVersion_formId_version_key" ON "TicketFormVersion"("formId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketJourney_guildId_isEnabled_order_idx" ON "TicketJourney"("guildId", "isEnabled", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketJourney_guildId_isPublished_idx" ON "TicketJourney"("guildId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TicketJourney_guildId_slug_key" ON "TicketJourney"("guildId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketRecord_guildId_journeyId_idx" ON "TicketRecord"("guildId", "journeyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketTranscript_guildId_kind_idx" ON "TicketTranscript"("guildId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketTranscript_expiresAt_idx" ON "TicketTranscript"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TicketTranscript_ticketId_kind_key" ON "TicketTranscript"("ticketId", "kind");

-- DropForeignKey — supprimer une catégorie ne doit plus emporter le ticket
ALTER TABLE "TicketRecord" DROP CONSTRAINT IF EXISTS "TicketRecord_categoryId_fkey";

-- AddForeignKey — parcours figé et file d'approbation du ticket
DO $$ BEGIN
    ALTER TABLE "TicketRecord" ADD CONSTRAINT "TicketRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketBotCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "TicketRecord" ADD CONSTRAINT "TicketRecord_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TicketJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "TicketRecord" ADD CONSTRAINT "TicketRecord_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "TicketFormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketTeam" ADD CONSTRAINT "TicketTeam_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketForm" ADD CONSTRAINT "TicketForm_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketFormVersion" ADD CONSTRAINT "TicketFormVersion_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketFormVersion" ADD CONSTRAINT "TicketFormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "TicketForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketJourney" ADD CONSTRAINT "TicketJourney_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketJourney" ADD CONSTRAINT "TicketJourney_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TicketTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketDraft" ADD CONSTRAINT "TicketDraft_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketDraft" ADD CONSTRAINT "TicketDraft_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TicketJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TicketJourney" ADD CONSTRAINT "TicketJourney_formId_fkey" FOREIGN KEY ("formId") REFERENCES "TicketForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


