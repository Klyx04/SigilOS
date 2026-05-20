-- CreateTable
CREATE TABLE "SubGuideData" (
    "id" TEXT NOT NULL,
    "guideRef" TEXT NOT NULL,
    "ganymadeId" INTEGER NOT NULL,
    "guideName" TEXT NOT NULL,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubGuideData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubGuideData_guideRef_key" ON "SubGuideData"("guideRef");

-- CreateIndex
CREATE UNIQUE INDEX "SubGuideData_ganymadeId_key" ON "SubGuideData"("ganymadeId");

-- CreateIndex
CREATE INDEX "SubGuideData_guideRef_idx" ON "SubGuideData"("guideRef");
