-- DropForeignKey
ALTER TABLE "GuildBonus" DROP CONSTRAINT "GuildBonus_purchasedBy_fkey";

-- AlterTable
ALTER TABLE "GuildBonus" ALTER COLUMN "purchasedBy" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GuildBonus" ADD CONSTRAINT "GuildBonus_purchasedBy_fkey" FOREIGN KEY ("purchasedBy") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
