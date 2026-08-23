-- CreateEnum
CREATE TYPE "GeoguesserSessionStatus" AS ENUM ('LOBBY', 'IN_PROGRESS', 'FINISHED');

-- CreateTable
CREATE TABLE "GeoguesserSession" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "status" "GeoguesserSessionStatus" NOT NULL DEFAULT 'LOBBY',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "maxRounds" INTEGER NOT NULL DEFAULT 5,
    "timePerRound" INTEGER NOT NULL DEFAULT 30,
    "targetMapIds" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoguesserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoguesserSessionPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "guesses" JSONB,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "hasGuessed" BOOLEAN NOT NULL DEFAULT false,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoguesserSessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeoguesserSession_guildId_status_idx" ON "GeoguesserSession"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GeoguesserSessionPlayer_sessionId_userId_key" ON "GeoguesserSessionPlayer"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "GeoguesserSessionPlayer" ADD CONSTRAINT "GeoguesserSessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GeoguesserSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
