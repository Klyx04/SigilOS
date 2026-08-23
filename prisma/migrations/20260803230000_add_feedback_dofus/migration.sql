-- AlterTable: SystemIssue — colonnes feedback (nullable, non-breaking)
ALTER TABLE "SystemIssue" ADD COLUMN "feedbackType" TEXT;
ALTER TABLE "SystemIssue" ADD COLUMN "sourcePage" TEXT;
ALTER TABLE "SystemIssue" ADD COLUMN "targetSlug" TEXT;
ALTER TABLE "SystemIssue" ADD COLUMN "guildId" TEXT;
ALTER TABLE "SystemIssue" ADD COLUMN "userAgent" TEXT;

-- Indexes
CREATE INDEX "SystemIssue_guildId_idx" ON "SystemIssue"("guildId");
CREATE INDEX "SystemIssue_feedbackType_idx" ON "SystemIssue"("feedbackType");

-- AlterTable: PlatformConfig — canal feedback dédié
ALTER TABLE "PlatformConfig" ADD COLUMN "questFeedbackChannelId" TEXT;

-- AlterEnum: GodNotifyType — nouveau type USER_FEEDBACK (ADD VALUE, non-breaking en Postgres < 12 ONLY si pas utilisé dans une colonne enum avec default... ici safe car jamais utilisé)
ALTER TYPE "GodNotifyType" ADD VALUE 'USER_FEEDBACK';