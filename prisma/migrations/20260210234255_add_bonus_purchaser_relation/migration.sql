-- AddForeignKey
ALTER TABLE "GuildBonus" ADD CONSTRAINT "GuildBonus_purchasedBy_fkey" FOREIGN KEY ("purchasedBy") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
