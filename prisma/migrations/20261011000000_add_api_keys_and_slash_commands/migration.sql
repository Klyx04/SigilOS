-- CreateTable
CREATE TABLE "GuildApiKey" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read:members']::TEXT[],
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSlashCommandPermission" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "roleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSlashCommandPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildApiKey_keyHash_key" ON "GuildApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "GuildApiKey_guildId_idx" ON "GuildApiKey"("guildId");

-- CreateIndex
CREATE INDEX "GuildApiKey_prefix_idx" ON "GuildApiKey"("prefix");

-- CreateIndex
CREATE INDEX "GuildApiKey_revokedAt_idx" ON "GuildApiKey"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuildSlashCommandPermission_guildId_commandName_key" ON "GuildSlashCommandPermission"("guildId", "commandName");

-- CreateIndex
CREATE INDEX "GuildSlashCommandPermission_guildId_idx" ON "GuildSlashCommandPermission"("guildId");

-- AddForeignKey
ALTER TABLE "GuildApiKey" ADD CONSTRAINT "GuildApiKey_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildSlashCommandPermission" ADD CONSTRAINT "GuildSlashCommandPermission_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
