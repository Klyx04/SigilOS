-- CreateTable
CREATE TABLE "DreamRunReminder" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "discordMessageId" TEXT NOT NULL,
    "discordChannelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DreamRunReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DreamRunReminder_runId_idx" ON "DreamRunReminder"("runId");

-- AddForeignKey
ALTER TABLE "DreamRunReminder" ADD CONSTRAINT "DreamRunReminder_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DreamRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
