-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "serviceLoansEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "serviceLoansMessage" TEXT,
ADD COLUMN     "serviceMarketplaceEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "serviceMarketplaceMessage" TEXT,
ADD COLUMN     "serviceVaultEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "serviceVaultMessage" TEXT;
