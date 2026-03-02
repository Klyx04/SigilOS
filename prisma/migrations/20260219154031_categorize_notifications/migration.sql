-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('MISSION', 'SUCCESS', 'SONGES', 'EVENT', 'POLL', 'ADMIN_ALERT', 'SYSTEM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'POLL_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'POLL_CLOSED';
ALTER TYPE "NotificationType" ADD VALUE 'ACHIEVEMENT_VALIDATED';
ALTER TYPE "NotificationType" ADD VALUE 'ACHIEVEMENT_REJECTED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM';

-- CreateIndex
CREATE INDEX "Notification_category_idx" ON "Notification"("category");
