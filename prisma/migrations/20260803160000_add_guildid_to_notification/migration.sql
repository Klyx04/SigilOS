-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "guildId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_guildId_idx" ON "Notification"("guildId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;