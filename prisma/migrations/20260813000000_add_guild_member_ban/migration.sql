-- Migration : table GuildMemberBan (tombstone guild-scopé multi-tenant)
-- F-01 : un membre banni OU supprimé par un admin reste exclu du dashboard
-- même si son UserProfile a été purgé. Empêche le ré-provisionnement automatique.

CREATE TABLE "GuildMemberBan" (
    "id"           TEXT NOT NULL,
    "guildId"      TEXT NOT NULL,
    "discordId"    TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "bannedBy"     TEXT NOT NULL,
    "bannedByName" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt"     TIMESTAMP(3),
    "liftedBy"     TEXT,
    "liftedByName" TEXT,

    CONSTRAINT "GuildMemberBan_pkey" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE UNIQUE INDEX "GuildMemberBan_guildId_discordId_key" ON "GuildMemberBan"("guildId", "discordId");

--> statement-breakpoint

CREATE INDEX "GuildMemberBan_guildId_idx" ON "GuildMemberBan"("guildId");

--> statement-breakpoint

CREATE INDEX "GuildMemberBan_discordId_idx" ON "GuildMemberBan"("discordId");

--> statement-breakpoint

ALTER TABLE "GuildMemberBan" ADD CONSTRAINT "GuildMemberBan_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
