-- AlterTable
ALTER TABLE "ReactionRoleOption" ADD COLUMN "extraRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ReactionRoleOption" ADD COLUMN "durationDays" INTEGER;

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "category" TEXT NOT NULL DEFAULT 'COMMUNITY',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "isGodOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "triggerValue" TEXT,
    "triggerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "reason" TEXT,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimedRoleGrant" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "roleName" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'REACTION_ROLE',

    CONSTRAINT "TimedRoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Badge_slug_key" ON "Badge"("slug");

-- CreateIndex
CREATE INDEX "Badge_category_idx" ON "Badge"("category");

-- CreateIndex
CREATE INDEX "Badge_rarity_idx" ON "Badge"("rarity");

-- CreateIndex
CREATE INDEX "Badge_triggerType_idx" ON "Badge"("triggerType");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_profileId_badgeId_key" ON "UserBadge"("profileId", "badgeId");

-- CreateIndex
CREATE INDEX "UserBadge_profileId_idx" ON "UserBadge"("profileId");

-- CreateIndex
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");

-- CreateIndex
CREATE INDEX "TimedRoleGrant_discordGuildId_expiresAt_revokedAt_idx" ON "TimedRoleGrant"("discordGuildId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "TimedRoleGrant_discordUserId_idx" ON "TimedRoleGrant"("discordUserId");

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
