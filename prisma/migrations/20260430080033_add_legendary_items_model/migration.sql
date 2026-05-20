-- CreateTable
CREATE TABLE "LegendaryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 200,
    "category" TEXT NOT NULL,
    "jobRequired" TEXT NOT NULL,
    "passiveName" TEXT,
    "passiveDesc" TEXT,
    "effects" JSONB,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegendaryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LegendaryCrafters" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LegendaryCrafters_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegendaryItem_name_key" ON "LegendaryItem"("name");

-- CreateIndex
CREATE INDEX "_LegendaryCrafters_B_index" ON "_LegendaryCrafters"("B");

-- AddForeignKey
ALTER TABLE "_LegendaryCrafters" ADD CONSTRAINT "_LegendaryCrafters_A_fkey" FOREIGN KEY ("A") REFERENCES "LegendaryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LegendaryCrafters" ADD CONSTRAINT "_LegendaryCrafters_B_fkey" FOREIGN KEY ("B") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
