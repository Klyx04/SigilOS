-- CreateTable
CREATE TABLE "BuildVote" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildVote_buildId_idx" ON "BuildVote"("buildId");

-- CreateIndex
CREATE INDEX "BuildVote_guildId_idx" ON "BuildVote"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildVote_buildId_userId_key" ON "BuildVote"("buildId", "userId");
