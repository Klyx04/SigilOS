-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('PASSAGE_DONJON', 'FORGEMAGIE', 'METIER', 'QUETE', 'OCRE', 'AUTRE');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('KAMAS', 'STUFF', 'RESSOURCES', 'AUTRE');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VaultAction" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "servicesNotifyChannelId" TEXT;

-- CreateTable
CREATE TABLE "ServiceListing" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT,
    "availability" TEXT,
    "discordMessageId" TEXT,
    "discordChannelId" TEXT,
    "contactMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildLoan" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "type" "LoanType" NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT NOT NULL,
    "amount" TEXT,
    "proofUrl" TEXT,
    "returnProofUrl" TEXT,
    "lentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "GuildLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultEntry" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "action" "VaultAction" NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER DEFAULT 1,
    "description" TEXT,
    "proofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceListing_guildId_status_idx" ON "ServiceListing"("guildId", "status");

-- CreateIndex
CREATE INDEX "ServiceListing_guildId_category_idx" ON "ServiceListing"("guildId", "category");

-- CreateIndex
CREATE INDEX "ServiceListing_profileId_idx" ON "ServiceListing"("profileId");

-- CreateIndex
CREATE INDEX "GuildLoan_guildId_status_idx" ON "GuildLoan"("guildId", "status");

-- CreateIndex
CREATE INDEX "GuildLoan_lenderId_idx" ON "GuildLoan"("lenderId");

-- CreateIndex
CREATE INDEX "GuildLoan_borrowerId_idx" ON "GuildLoan"("borrowerId");

-- CreateIndex
CREATE INDEX "VaultEntry_guildId_createdAt_idx" ON "VaultEntry"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "VaultEntry_profileId_idx" ON "VaultEntry"("profileId");

-- CreateIndex
CREATE INDEX "DreamJoinRequest_userId_idx" ON "DreamJoinRequest"("userId");

-- CreateIndex
CREATE INDEX "MissionInterest_profileId_idx" ON "MissionInterest"("profileId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildLoan" ADD CONSTRAINT "GuildLoan_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildLoan" ADD CONSTRAINT "GuildLoan_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildLoan" ADD CONSTRAINT "GuildLoan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
