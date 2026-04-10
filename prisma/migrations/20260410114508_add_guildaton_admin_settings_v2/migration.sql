-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "guildatonAdminChannelId" TEXT,
ADD COLUMN     "guildatonNotifyChannelId" TEXT,
ADD COLUMN     "guildatonReminderDay" INTEGER DEFAULT 0,
ADD COLUMN     "guildatonReminderTime" TEXT DEFAULT '18:00',
ADD COLUMN     "guildatonTrackedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "guildatonWeeklyQuota" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "discordMessageCountMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordMessageCountTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordVoiceTimeMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordVoiceTimeTotal" INTEGER NOT NULL DEFAULT 0;
