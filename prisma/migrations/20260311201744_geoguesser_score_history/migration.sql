-- CreateTable
CREATE TABLE "GeoguesserScore" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "score" INTEGER NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoguesserScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeoguesserScore_guildId_createdAt_idx" ON "GeoguesserScore"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "GeoguesserScore_guildId_score_idx" ON "GeoguesserScore"("guildId", "score");
