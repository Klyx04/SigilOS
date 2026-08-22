-- #201 - Track Discord embeds of loans (GuildLoan) and vault entries (VaultEntry)
-- so they can be deleted on close/delete (prevents the black-image embed).

-- AlterTable
ALTER TABLE "GuildLoan" ADD COLUMN     "discordChannelId" TEXT,
ADD COLUMN     "discordMessageId" TEXT;

-- AlterTable
ALTER TABLE "VaultEntry" ADD COLUMN     "discordChannelId" TEXT,
ADD COLUMN     "discordMessageId" TEXT;
