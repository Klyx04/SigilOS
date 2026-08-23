-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "archiveDuration" INTEGER,
ADD COLUMN     "reactivationRequestReason" TEXT,
ADD COLUMN     "reactivationRequestedAt" TIMESTAMP(3);
