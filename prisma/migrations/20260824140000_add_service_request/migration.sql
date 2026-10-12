-- Migrate ServiceFeedback: add serviceRequestId (optional), isModerated
ALTER TABLE "ServiceFeedback"
  ADD COLUMN "serviceRequestId" TEXT UNIQUE,
  ADD COLUMN "isModerated" BOOLEAN NOT NULL DEFAULT false;

-- Add FK constraint from ServiceFeedback to ServiceRequest (set after table creation)
-- (will be added after ServiceRequest table is created below)

-- Create ServiceRequestStatus enum
CREATE TYPE "ServiceRequestStatus" AS ENUM (
  'PENDING',
  'REPLIED',
  'CLOSED',
  'CANCELLED'
);

-- Create ServiceRequest table
CREATE TABLE "ServiceRequest" (
  "id"                TEXT NOT NULL,
  "guildId"           TEXT NOT NULL,
  "listingId"         TEXT NOT NULL,
  "clientProfileId"   TEXT NOT NULL,
  "clientUserId"      TEXT NOT NULL,
  "clientName"        TEXT NOT NULL,
  "clientAvatar"      TEXT,
  "providerProfileId" TEXT NOT NULL,
  "providerUserId"    TEXT NOT NULL,
  "options"           JSONB,
  "customMessage"     TEXT,
  "status"            "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
  "discordMessageId"  TEXT,
  "closedAt"          TIMESTAMP(3),
  "feedbackToken"     TEXT UNIQUE,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ServiceRequest_guildId_status_idx" ON "ServiceRequest"("guildId", "status");
CREATE INDEX "ServiceRequest_listingId_idx" ON "ServiceRequest"("listingId");
CREATE INDEX "ServiceRequest_clientProfileId_idx" ON "ServiceRequest"("clientProfileId");
CREATE INDEX "ServiceRequest_providerProfileId_idx" ON "ServiceRequest"("providerProfileId");

-- Foreign Keys
ALTER TABLE "ServiceRequest"
  ADD CONSTRAINT "ServiceRequest_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceRequest_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "ServiceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceRequest_clientProfileId_fkey"
    FOREIGN KEY ("clientProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceRequest_providerProfileId_fkey"
    FOREIGN KEY ("providerProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Now add FK from ServiceFeedback to ServiceRequest
ALTER TABLE "ServiceFeedback"
  ADD CONSTRAINT "ServiceFeedback_serviceRequestId_fkey"
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
