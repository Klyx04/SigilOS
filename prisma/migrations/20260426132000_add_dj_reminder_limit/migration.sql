-- DropForeignKey
ALTER TABLE "UserSkin" DROP CONSTRAINT "UserSkin_skinId_fkey";

-- DropForeignKey
ALTER TABLE "UserSkin" DROP CONSTRAINT "UserSkin_userId_fkey";

-- AlterTable
ALTER TABLE "BlacklistEntry" ADD COLUMN     "discordMessageId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Bounty" ADD COLUMN     "doplons" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mapUrl" TEXT,
ADD COLUMN     "mechanics" TEXT,
ADD COLUMN     "milice" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "rewardType" TEXT NOT NULL DEFAULT 'Doplon',
ADD COLUMN     "rewards" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "DjSearchPost" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "mentionRoleId" TEXT;

-- AlterTable
ALTER TABLE "DreamJoinRequest" ADD COLUMN     "linkedStuffId" TEXT,
ADD COLUMN     "linkedStuffName" TEXT,
ADD COLUMN     "linkedStuffThumbnail" TEXT,
ADD COLUMN     "linkedStuffUrl" TEXT;

-- AlterTable
ALTER TABLE "DreamRun" ADD COLUMN     "mentionRoleId" TEXT;

-- AlterTable
ALTER TABLE "DreamRunMember" ADD COLUMN     "linkedStuffId" TEXT,
ADD COLUMN     "linkedStuffName" TEXT,
ADD COLUMN     "linkedStuffThumbnail" TEXT,
ADD COLUMN     "linkedStuffUrl" TEXT;

-- AlterTable
ALTER TABLE "Dungeon" ADD COLUMN     "dofensiveUrl" TEXT,
ADD COLUMN     "dofuspourlesnoobsUrl" TEXT;

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "blacklistChannelId" TEXT,
ADD COLUMN     "missionDiscordMessageId" TEXT,
ADD COLUMN     "skinGalleryChannelId" TEXT,
ADD COLUMN     "stuffGalleryChannelId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "lastGalleryShareAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserSkin" DROP CONSTRAINT "UserSkin_pkey",
DROP COLUMN "acquiredAt",
DROP COLUMN "isFavorite",
DROP COLUMN "skinId",
DROP COLUMN "userId",
ADD COLUMN     "colors" JSONB,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "discordMessageId" TEXT,
ADD COLUMN     "equipment" JSONB,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "profileId" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "url" TEXT NOT NULL,
ADD CONSTRAINT "UserSkin_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "Skin";

-- CreateTable
CREATE TABLE "SkinVote" (
    "id" TEXT NOT NULL,
    "skinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkinVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizedGuide" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimizedGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizedGuideStep" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questIds" TEXT[],
    "customTasks" JSONB DEFAULT '[]',
    "objectives" JSONB DEFAULT '[]',

    CONSTRAINT "OptimizedGuideStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkinVote_skinId_idx" ON "SkinVote"("skinId");

-- CreateIndex
CREATE INDEX "SkinVote_guildId_idx" ON "SkinVote"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "SkinVote_skinId_userId_key" ON "SkinVote"("skinId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizedGuide_slug_key" ON "OptimizedGuide"("slug");

-- CreateIndex
CREATE INDEX "OptimizedGuideStep_guideId_idx" ON "OptimizedGuideStep"("guideId");

-- CreateIndex
CREATE INDEX "OptimizedGuideStep_guideId_order_idx" ON "OptimizedGuideStep"("guideId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistEntry_discordMessageId_key" ON "BlacklistEntry"("discordMessageId");

-- CreateIndex
CREATE INDEX "BlacklistEntry_discordMessageId_idx" ON "BlacklistEntry"("discordMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkin_discordMessageId_key" ON "UserSkin"("discordMessageId");

-- CreateIndex
CREATE INDEX "UserSkin_profileId_idx" ON "UserSkin"("profileId");

-- CreateIndex
CREATE INDEX "UserSkin_url_idx" ON "UserSkin"("url");

-- CreateIndex
CREATE INDEX "UserSkin_discordMessageId_idx" ON "UserSkin"("discordMessageId");

-- AddForeignKey
ALTER TABLE "UserSkin" ADD CONSTRAINT "UserSkin_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkinVote" ADD CONSTRAINT "SkinVote_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "UserSkin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizedGuideStep" ADD CONSTRAINT "OptimizedGuideStep_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "OptimizedGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
