-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "targetGuildId" TEXT,
ADD COLUMN     "targetGuildMemberCount" INTEGER,
ADD COLUMN     "targetGuildName" TEXT;

-- CreateIndex
CREATE INDEX "SupportTicket_targetGuildId_idx" ON "SupportTicket"("targetGuildId");
