-- CreateTable
CREATE TABLE "MiniGameStatus" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMsg" TEXT DEFAULT '🔧 Ce jeu est temporairement indisponible pour maintenance.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniGameStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigilKingRank" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigilKingRank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigilKingScore" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "score" INTEGER NOT NULL,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigilKingScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigilKingSession" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "maxRounds" INTEGER NOT NULL DEFAULT 1,
    "targetScore" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigilKingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigilKingSessionPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "roundScore" INTEGER NOT NULL DEFAULT 0,
    "cards" JSONB,
    "hasPlayed" BOOLEAN NOT NULL DEFAULT false,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigilKingSessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiniGameStatus_gameId_key" ON "MiniGameStatus"("gameId");

-- CreateIndex
CREATE INDEX "SigilKingRank_guildId_bestScore_idx" ON "SigilKingRank"("guildId", "bestScore");

-- CreateIndex
CREATE UNIQUE INDEX "SigilKingRank_guildId_userId_key" ON "SigilKingRank"("guildId", "userId");

-- CreateIndex
CREATE INDEX "SigilKingScore_guildId_createdAt_idx" ON "SigilKingScore"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "SigilKingScore_guildId_score_idx" ON "SigilKingScore"("guildId", "score");

-- CreateIndex
CREATE INDEX "SigilKingSession_guildId_status_idx" ON "SigilKingSession"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SigilKingSessionPlayer_sessionId_userId_key" ON "SigilKingSessionPlayer"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "SigilKingSessionPlayer" ADD CONSTRAINT "SigilKingSessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SigilKingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
