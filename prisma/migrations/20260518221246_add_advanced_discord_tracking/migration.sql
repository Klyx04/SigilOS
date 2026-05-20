-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "discordCharactersMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordCharactersTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordCharactersWeekly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordReactionsReceivedMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordReactionsReceivedTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordReactionsReceivedWeekly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordRepliesMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordRepliesTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordRepliesWeekly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordVoiceStreamTimeMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordVoiceStreamTimeTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discordVoiceStreamTimeWeekly" INTEGER NOT NULL DEFAULT 0;
