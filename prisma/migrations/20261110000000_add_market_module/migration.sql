-- 🛒 Module « Marché » — chantier 2026-09-10 (branche B1 = S1)
--
-- Migration IDEMPOTENTE (rejouable sans dégât) : `IF NOT EXISTS` partout où
-- PostgreSQL le permet, blocs `DO $$ … EXCEPTION WHEN duplicate_object` pour
-- les types énumérés et les contraintes. Aucune opération destructive.
--
-- Isolation multi-tenant : `guildId` = GuildConfig.id (jamais le snowflake).

-- ── 1) Toggle de module (OFF par défaut pour les nouvelles guildes) ────────
ALTER TABLE "GuildModules" ADD COLUMN IF NOT EXISTS "marche" BOOLEAN NOT NULL DEFAULT false;

-- ── 2) Réglages de guilde (§9.1) ──────────────────────────────────────────
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketNotifyChannelId" TEXT;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketNotifyRoleId" TEXT;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketAllowedPingRoleIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketModeratorRoleId" TEXT;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketMinRoleId" TEXT;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketMaxActivePerMember" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketDefaultDurationDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketMaxLifetimeDays" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketReminderDays" JSONB NOT NULL DEFAULT '[7, 15]';
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketReservationHours" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketOfferHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketNegotiationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketProofsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketMediaRetentionDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketLogRetentionDays" INTEGER NOT NULL DEFAULT 365;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketChannelKind" TEXT;
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketForumTags" JSONB;

-- ── 3) Types énumérés (idempotents) ───────────────────────────────────────
DO $$ BEGIN CREATE TYPE "MarketListingType" AS ENUM ('EQUIPMENT', 'RESOURCE', 'SERVICE', 'WANTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RESERVED', 'SOLD', 'EXPIRED', 'WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketStatOrigin" AS ENUM ('NATIVE', 'EXO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketStatQuality" AS ENUM ('LOW', 'NORMAL', 'GOOD', 'PERFECT', 'OVER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketReservationStatus" AS ENUM ('ACTIVE', 'CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'EXPIRED', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketMediaType" AS ENUM ('PROOF_SCREENSHOT', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketReportReason" AS ENUM ('JET_MISMATCH', 'SELLER_UNREACHABLE', 'BUYER_ABSENT', 'SUSPICIOUS', 'FORBIDDEN', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4) Table principale : MarketListing ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "MarketListing" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MarketListingType" NOT NULL DEFAULT 'EQUIPMENT',
    "status" "MarketListingStatus" NOT NULL DEFAULT 'DRAFT',
    "dofusDbItemId" INTEGER,
    "itemName" TEXT,
    "itemIconUrl" TEXT,
    "itemLevel" INTEGER,
    "itemTypeName" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "forgedBy" TEXT,
    "priceKamas" INTEGER,
    "negotiable" BOOLEAN NOT NULL DEFAULT true,
    "acceptsTrade" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER,
    "unitLabel" TEXT,
    "minQuantity" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reservedUntil" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "reminderStage" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "renewCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedReason" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'GUILD',
    "statsHash" TEXT,
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketListing_guildId_status_idx" ON "MarketListing"("guildId", "status");
CREATE INDEX IF NOT EXISTS "MarketListing_guildId_type_status_idx" ON "MarketListing"("guildId", "type", "status");
CREATE INDEX IF NOT EXISTS "MarketListing_guildId_status_expiresAt_idx" ON "MarketListing"("guildId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "MarketListing_profileId_status_idx" ON "MarketListing"("profileId", "status");
CREATE INDEX IF NOT EXISTS "MarketListing_guildId_dofusDbItemId_idx" ON "MarketListing"("guildId", "dofusDbItemId");

-- ── 5) Jet déclaré : MarketListingStat ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MarketListingStat" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "effectId" INTEGER NOT NULL,
    "characteristic" INTEGER,
    "label" TEXT NOT NULL,
    "naturalMin" INTEGER,
    "naturalMax" INTEGER,
    "actualValue" INTEGER NOT NULL,
    "origin" "MarketStatOrigin" NOT NULL DEFAULT 'NATIVE',
    "quality" "MarketStatQuality" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketListingStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketListingStat_listingId_effectId_origin_key" ON "MarketListingStat"("listingId", "effectId", "origin");
CREATE INDEX IF NOT EXISTS "MarketListingStat_listingId_idx" ON "MarketListingStat"("listingId");

-- ── 6) Lots de ressources : MarketListingComponent ────────────────────────
CREATE TABLE IF NOT EXISTS "MarketListingComponent" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "dofusDbItemId" INTEGER,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketListingComponent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketListingComponent_listingId_position_idx" ON "MarketListingComponent"("listingId", "position");


-- ── 7) Négociation : MarketOffer ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MarketOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "offeredKamas" INTEGER,
    "tradeDescription" TEXT,
    "note" TEXT,
    "status" "MarketOfferStatus" NOT NULL DEFAULT 'PENDING',
    "counterOfId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketOffer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketOffer_listingId_status_idx" ON "MarketOffer"("listingId", "status");
CREATE INDEX IF NOT EXISTS "MarketOffer_buyerProfileId_status_idx" ON "MarketOffer"("buyerProfileId", "status");
CREATE INDEX IF NOT EXISTS "MarketOffer_status_expiresAt_idx" ON "MarketOffer"("status", "expiresAt");

-- ── 8) Réservation : MarketReservation ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MarketReservation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "status" "MarketReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketReservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketReservation_listingId_status_idx" ON "MarketReservation"("listingId", "status");
CREATE INDEX IF NOT EXISTS "MarketReservation_buyerProfileId_status_idx" ON "MarketReservation"("buyerProfileId", "status");
CREATE INDEX IF NOT EXISTS "MarketReservation_status_expiresAt_idx" ON "MarketReservation"("status", "expiresAt");

-- ── 9) Preuves : MarketListingMedia ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MarketListingMedia" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "MarketMediaType" NOT NULL DEFAULT 'PROOF_SCREENSHOT',
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketListingMedia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketListingMedia_listingId_idx" ON "MarketListingMedia"("listingId");


-- ── 10) Publication Discord : MarketDiscordMessage ────────────────────────
CREATE TABLE IF NOT EXISTS "MarketDiscordMessage" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "discordChannelId" TEXT NOT NULL,
    "discordMessageId" TEXT NOT NULL,
    "generatedImageStorageKey" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncStatus" TEXT NOT NULL DEFAULT 'OK',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketDiscordMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketDiscordMessage_listingId_key" ON "MarketDiscordMessage"("listingId");
CREATE INDEX IF NOT EXISTS "MarketDiscordMessage_discordGuildId_syncStatus_idx" ON "MarketDiscordMessage"("discordGuildId", "syncStatus");

-- ── 11) Signalements : MarketReport ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MarketReport" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reporterProfileId" TEXT NOT NULL,
    "reason" "MarketReportReason" NOT NULL DEFAULT 'OTHER',
    "details" TEXT,
    "snapshot" JSONB,
    "status" "MarketReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketReport_listingId_status_idx" ON "MarketReport"("listingId", "status");
CREATE INDEX IF NOT EXISTS "MarketReport_status_createdAt_idx" ON "MarketReport"("status", "createdAt");

-- ── 12) Journal d'audit : MarketAuditLog ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "MarketAuditLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "listingId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "previousData" JSONB,
    "nextData" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketAuditLog_guildId_createdAt_idx" ON "MarketAuditLog"("guildId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketAuditLog_listingId_idx" ON "MarketAuditLog"("listingId");

-- ── 13) Clés étrangères (idempotentes) ───────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketListingStat" ADD CONSTRAINT "MarketListingStat_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketListingComponent" ADD CONSTRAINT "MarketListingComponent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketOffer" ADD CONSTRAINT "MarketOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketReservation" ADD CONSTRAINT "MarketReservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketListingMedia" ADD CONSTRAINT "MarketListingMedia_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketDiscordMessage" ADD CONSTRAINT "MarketDiscordMessage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketReport" ADD CONSTRAINT "MarketReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketAuditLog" ADD CONSTRAINT "MarketAuditLog_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

