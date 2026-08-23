-- CreateTable
CREATE TABLE "GeoguesserRank" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "avgDistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoguesserRank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeoguesserRank_guildId_bestScore_idx" ON "GeoguesserRank"("guildId", "bestScore");

-- CreateIndex
CREATE UNIQUE INDEX "GeoguesserRank_guildId_userId_key" ON "GeoguesserRank"("guildId", "userId");
