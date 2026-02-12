-- CreateTable
CREATE TABLE "DocPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocPage_slug_key" ON "DocPage"("slug");

-- CreateIndex
CREATE INDEX "DocPage_category_order_idx" ON "DocPage"("category", "order");

-- CreateIndex
CREATE INDEX "DocPage_slug_idx" ON "DocPage"("slug");
