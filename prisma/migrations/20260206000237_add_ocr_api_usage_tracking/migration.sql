-- CreateTable
CREATE TABLE "OcrApiUsage" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpoint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcrApiUsage_date_idx" ON "OcrApiUsage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OcrApiUsage_date_endpoint_key" ON "OcrApiUsage"("date", "endpoint");
