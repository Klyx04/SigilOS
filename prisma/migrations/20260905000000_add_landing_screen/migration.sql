-- CreateTable
CREATE TABLE "LandingScreen" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'product-story',
    "label" TEXT,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingScreen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingScreen_section_enabled_sortOrder_idx" ON "LandingScreen"("section", "enabled", "sortOrder");
