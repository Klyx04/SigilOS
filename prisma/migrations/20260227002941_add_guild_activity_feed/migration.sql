-- CreateTable
CREATE TABLE "GuildActivity" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorImage" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildActivity_guildId_createdAt_idx" ON "GuildActivity"("guildId", "createdAt");

-- AddForeignKey
ALTER TABLE "GuildActivity" ADD CONSTRAINT "GuildActivity_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
