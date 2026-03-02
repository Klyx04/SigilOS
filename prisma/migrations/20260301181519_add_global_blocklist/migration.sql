-- CreateTable
CREATE TABLE "GlobalBlocklist" (
    "id" TEXT NOT NULL DEFAULT 'GLOBAL',
    "words" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalBlocklist_pkey" PRIMARY KEY ("id")
);
