-- CreateEnum
CREATE TYPE "KamaDonationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- CreateTable
CREATE TABLE "KamaDonation" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "proofUrl" TEXT,
    "status" "KamaDonationStatus" NOT NULL DEFAULT 'PENDING',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "note" TEXT,
    "weekNumber" INTEGER,
    "yearNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KamaDonation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KamaDonation_guildId_status_idx" ON "KamaDonation"("guildId", "status");

-- CreateIndex
CREATE INDEX "KamaDonation_guildId_createdAt_idx" ON "KamaDonation"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "KamaDonation_profileId_idx" ON "KamaDonation"("profileId");

-- AddForeignKey
ALTER TABLE "KamaDonation" ADD CONSTRAINT "KamaDonation_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KamaDonation" ADD CONSTRAINT "KamaDonation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
