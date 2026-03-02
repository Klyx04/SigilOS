-- AlterTable
ALTER TABLE "GlobalBlocklist" ADD COLUMN     "allowedDomains" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "baseWords" JSONB NOT NULL DEFAULT '[]';
