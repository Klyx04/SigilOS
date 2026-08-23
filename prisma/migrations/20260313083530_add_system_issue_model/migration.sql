-- CreateEnum
CREATE TYPE "SystemIssueType" AS ENUM ('BUG', 'AMELIORATION');

-- CreateEnum
CREATE TYPE "SystemIssueStatus" AS ENUM ('A_FAIRE', 'A_INVESTIGUER', 'EN_COURS', 'TERMINE', 'IGNORE');

-- CreateTable
CREATE TABLE "SystemIssue" (
    "id" SERIAL NOT NULL,
    "type" "SystemIssueType" NOT NULL DEFAULT 'BUG',
    "category" TEXT NOT NULL DEFAULT 'Divers',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "description" TEXT NOT NULL,
    "status" "SystemIssueStatus" NOT NULL DEFAULT 'A_FAIRE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "forumLink" TEXT,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "SystemIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemIssue_status_idx" ON "SystemIssue"("status");

-- CreateIndex
CREATE INDEX "SystemIssue_type_idx" ON "SystemIssue"("type");

-- CreateIndex
CREATE INDEX "SystemIssue_createdAt_idx" ON "SystemIssue"("createdAt");
