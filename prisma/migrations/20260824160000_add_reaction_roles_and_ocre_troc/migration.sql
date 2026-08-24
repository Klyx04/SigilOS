-- AlterTable
ALTER TABLE "OcreTradeRequest" ADD COLUMN IF NOT EXISTS "monsterStep" INTEGER,
ADD COLUMN IF NOT EXISTS "offeredMonsterId" INTEGER,
ADD COLUMN IF NOT EXISTS "offeredMonsterImageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "offeredMonsterName" TEXT,
ADD COLUMN IF NOT EXISTS "offeredMonsterStep" INTEGER;

-- AlterTable
ALTER TABLE "GuildModules" ADD COLUMN IF NOT EXISTS "reactionRoles" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReactionRoleGroup" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "logChannelId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'NORMAL',
    "style" TEXT NOT NULL DEFAULT 'BUTTONS',
    "maxRoles" INTEGER,
    "embedTitle" TEXT,
    "embedDescription" TEXT,
    "embedColor" TEXT DEFAULT '#10b981',
    "embedThumbnail" TEXT,
    "embedImage" TEXT,
    "embedFooter" TEXT,
    "showRoleCount" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionRoleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReactionRoleOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "roleColor" TEXT,
    "emoji" TEXT,
    "label" TEXT,
    "description" TEXT,
    "buttonStyle" TEXT NOT NULL DEFAULT 'SECONDARY',
    "position" INTEGER NOT NULL DEFAULT 0,
    "maxMembers" INTEGER,
    "removeRoleId" TEXT,
    "removeRoleName" TEXT,
    "requiredRoleId" TEXT,
    "requiredRoleName" TEXT,
    "blacklistedRoleId" TEXT,
    "blacklistedRoleName" TEXT,

    CONSTRAINT "ReactionRoleOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReactionRoleIconPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CUSTOM',
    "icons" JSONB NOT NULL DEFAULT '[]',
    "isGodOnly" BOOLEAN NOT NULL DEFAULT false,
    "guildId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionRoleIconPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReactionRoleGroup_guildId_idx" ON "ReactionRoleGroup"("guildId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReactionRoleOption_groupId_idx" ON "ReactionRoleOption"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReactionRoleIconPack_guildId_idx" ON "ReactionRoleIconPack"("guildId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReactionRoleGroup_guildId_fkey') THEN
        ALTER TABLE "ReactionRoleGroup" ADD CONSTRAINT "ReactionRoleGroup_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReactionRoleOption_groupId_fkey') THEN
        ALTER TABLE "ReactionRoleOption" ADD CONSTRAINT "ReactionRoleOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReactionRoleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReactionRoleIconPack_guildId_fkey') THEN
        ALTER TABLE "ReactionRoleIconPack" ADD CONSTRAINT "ReactionRoleIconPack_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
