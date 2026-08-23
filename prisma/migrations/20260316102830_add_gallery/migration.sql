/*
  Warnings:

  - A unique constraint covering the columns `[hash]` on the table `ImageHash` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ImageHash_guildId_hash_key";

-- AlterTable
ALTER TABLE "GuildModules" ADD COLUMN     "gallery" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "ImageHash_hash_key" ON "ImageHash"("hash");
