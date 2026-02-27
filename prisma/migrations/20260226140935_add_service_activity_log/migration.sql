-- CreateTable
CREATE TABLE "ServiceActivityLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceActivityLog_guildId_module_createdAt_idx" ON "ServiceActivityLog"("guildId", "module", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceActivityLog_entityId_idx" ON "ServiceActivityLog"("entityId");

-- CreateIndex
CREATE INDEX "ServiceActivityLog_actorId_idx" ON "ServiceActivityLog"("actorId");

-- AddForeignKey
ALTER TABLE "ServiceActivityLog" ADD CONSTRAINT "ServiceActivityLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceActivityLog" ADD CONSTRAINT "ServiceActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
