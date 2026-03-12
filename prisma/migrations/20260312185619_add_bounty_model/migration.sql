-- CreateTable
CREATE TABLE "Bounty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "zoneName" TEXT,
    "imageUrl" TEXT,
    "reward" TEXT,
    "levelMin" INTEGER,
    "levelMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bounty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bounty_name_key" ON "Bounty"("name");

-- CreateIndex
CREATE INDEX "Bounty_name_idx" ON "Bounty"("name");

-- CreateIndex
CREATE INDEX "Bounty_zoneName_idx" ON "Bounty"("zoneName");
