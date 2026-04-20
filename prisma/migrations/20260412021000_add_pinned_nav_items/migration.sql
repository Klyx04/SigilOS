-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "pinnedNavItems" TEXT[] DEFAULT ARRAY[]::TEXT[];
