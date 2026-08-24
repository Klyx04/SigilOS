-- CreateTable
CREATE TABLE "ServiceFeedback" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientAvatar" TEXT,
    "serviceListingId" TEXT,
    "serviceTitle" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceFeedback_guildId_providerProfileId_idx" ON "ServiceFeedback"("guildId", "providerProfileId");

-- CreateIndex
CREATE INDEX "ServiceFeedback_providerProfileId_idx" ON "ServiceFeedback"("providerProfileId");

-- AddForeignKey
ALTER TABLE "ServiceFeedback" ADD CONSTRAINT "ServiceFeedback_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceFeedback" ADD CONSTRAINT "ServiceFeedback_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
