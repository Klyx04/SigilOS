-- CreateTable
CREATE TABLE "ContentCreator" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "youtube" TEXT,
    "twitch" TEXT,
    "handle" TEXT,
    "color" TEXT NOT NULL DEFAULT '#ef4444',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCreator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentCreator_guildId_idx" ON "ContentCreator"("guildId");

-- AddForeignKey
ALTER TABLE "ContentCreator" ADD CONSTRAINT "ContentCreator_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
