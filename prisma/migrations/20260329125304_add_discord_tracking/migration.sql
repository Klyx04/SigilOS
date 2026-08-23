-- AlterTable
ALTER TABLE "DofusQuestEntry" ADD COLUMN     "coords" JSONB,
ADD COLUMN     "mapId" INTEGER;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "discordMessageCountWeekly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordVoiceTimeWeekly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDiscordMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastDiscordReactionAt" TIMESTAMP(3),
ADD COLUMN     "lastDiscordTypingAt" TIMESTAMP(3),
ADD COLUMN     "lastDiscordVoiceAt" TIMESTAMP(3);
