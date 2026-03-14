-- CreateTable
CREATE TABLE "Relance" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetIds" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "criteria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Relance_guildId_idx" ON "Relance"("guildId");

-- CreateIndex
CREATE INDEX "Relance_adminId_idx" ON "Relance"("adminId");

-- AddForeignKey
ALTER TABLE "Relance" ADD CONSTRAINT "Relance_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relance" ADD CONSTRAINT "Relance_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
