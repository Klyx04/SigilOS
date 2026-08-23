-- CreateTable
CREATE TABLE "GarticRoom" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'NORMAL',
    "maxPlayers" INTEGER NOT NULL DEFAULT 8,
    "maxRounds" INTEGER NOT NULL DEFAULT 3,
    "drawTime" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GarticRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarticSession" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GarticSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarticAlbum" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "GarticAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarticAlbumEntry" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GarticAlbumEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarticPlayerStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "correctGuesses" INTEGER NOT NULL DEFAULT 0,
    "drawingsCreated" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GarticPlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GarticSession_roomId_userId_key" ON "GarticSession"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GarticPlayerStats_userId_key" ON "GarticPlayerStats"("userId");

-- AddForeignKey
ALTER TABLE "GarticRoom" ADD CONSTRAINT "GarticRoom_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarticSession" ADD CONSTRAINT "GarticSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GarticRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarticSession" ADD CONSTRAINT "GarticSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarticAlbum" ADD CONSTRAINT "GarticAlbum_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GarticRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarticAlbumEntry" ADD CONSTRAINT "GarticAlbumEntry_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "GarticAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarticPlayerStats" ADD CONSTRAINT "GarticPlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
