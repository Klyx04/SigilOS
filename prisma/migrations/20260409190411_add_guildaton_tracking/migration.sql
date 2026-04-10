-- CreateTable
CREATE TABLE "GuildatonRecord" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT,
    "ankamaId" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildatonRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildatonHistory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildatonHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildatonRecord_guildId_idx" ON "GuildatonRecord"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildatonRecord_guildId_discordId_key" ON "GuildatonRecord"("guildId", "discordId");

-- CreateIndex
CREATE INDEX "GuildatonHistory_guildId_discordId_idx" ON "GuildatonHistory"("guildId", "discordId");

-- CreateIndex
CREATE INDEX "GuildatonHistory_createdAt_idx" ON "GuildatonHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "GuildatonRecord" ADD CONSTRAINT "GuildatonRecord_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildatonHistory" ADD CONSTRAINT "GuildatonHistory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
