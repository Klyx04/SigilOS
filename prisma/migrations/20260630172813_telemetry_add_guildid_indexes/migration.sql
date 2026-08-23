-- CreateIndex
CREATE INDEX "TelemetryEvent_guildId_idx" ON "TelemetryEvent"("guildId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_guildId_createdAt_idx" ON "TelemetryEvent"("guildId", "createdAt");
