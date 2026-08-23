-- CreateTable
CREATE TABLE "SkribblRank" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkribblRank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkribblScore" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkribblScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkribblRank_guildId_bestScore_idx" ON "SkribblRank"("guildId", "bestScore");

-- CreateIndex
CREATE UNIQUE INDEX "SkribblRank_guildId_userId_key" ON "SkribblRank"("guildId", "userId");

-- CreateIndex
CREATE INDEX "SkribblScore_guildId_createdAt_idx" ON "SkribblScore"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "SkribblScore_guildId_score_idx" ON "SkribblScore"("guildId", "score");
