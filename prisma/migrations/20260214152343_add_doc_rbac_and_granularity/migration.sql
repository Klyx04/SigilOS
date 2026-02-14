-- CreateEnum
CREATE TYPE "DocAccessLevel" AS ENUM ('PUBLIC', 'ADMIN');

-- AlterTable
ALTER TABLE "DocPage" ADD COLUMN     "accessLevel" "DocAccessLevel" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "guildId" TEXT;

-- CreateIndex
CREATE INDEX "DocPage_guildId_accessLevel_idx" ON "DocPage"("guildId", "accessLevel");
