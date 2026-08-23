-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('ACCESS_REQUEST', 'BUG_REPORT', 'FEATURE_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'CLOSED');

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" SERIAL NOT NULL,
    "discordThreadId" TEXT,
    "discordGuildId" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "creatorDiscordId" TEXT NOT NULL,
    "creatorDiscordName" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closedReason" TEXT,
    "transcript" JSON,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_discordThreadId_key" ON "SupportTicket"("discordThreadId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_category_idx" ON "SupportTicket"("category");

-- CreateIndex
CREATE INDEX "SupportTicket_creatorDiscordId_idx" ON "SupportTicket"("creatorDiscordId");

-- CreateIndex
CREATE INDEX "SupportTicket_discordGuildId_idx" ON "SupportTicket"("discordGuildId");
