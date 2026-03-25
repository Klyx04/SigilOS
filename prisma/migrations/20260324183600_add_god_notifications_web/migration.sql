-- CreateEnum
CREATE TYPE "GodNotifyType" AS ENUM ('VPS_MAINTENANCE', 'BACKUP', 'WORKER_SYNC', 'TICKET', 'GEOGUESSER_REPORT', 'SECURITY_ALERT', 'SYSTEM');

-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "godNotifyWebEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GodNotification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "GodNotifyType" NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GodNotification_pkey" PRIMARY KEY ("id")
);
