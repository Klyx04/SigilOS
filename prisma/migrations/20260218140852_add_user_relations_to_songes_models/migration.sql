-- Clean up orphaned records before adding constraints
DELETE FROM "DreamRun" WHERE "leaderId" NOT IN (SELECT "id" FROM "User");
DELETE FROM "DreamRunMember" WHERE "userId" NOT IN (SELECT "id" FROM "User");
DELETE FROM "DreamWaitlist" WHERE "userId" NOT IN (SELECT "id" FROM "User");
DELETE FROM "DreamJoinRequest" WHERE "userId" NOT IN (SELECT "id" FROM "User");

-- AddForeignKey
ALTER TABLE "DreamRun" ADD CONSTRAINT "DreamRun_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamRunMember" ADD CONSTRAINT "DreamRunMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamWaitlist" ADD CONSTRAINT "DreamWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreamJoinRequest" ADD CONSTRAINT "DreamJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
