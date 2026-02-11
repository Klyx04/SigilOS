-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "contributionPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "_SubmissionHelpers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SubmissionHelpers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SubmissionHelpers_B_index" ON "_SubmissionHelpers"("B");

-- AddForeignKey
ALTER TABLE "_SubmissionHelpers" ADD CONSTRAINT "_SubmissionHelpers_A_fkey" FOREIGN KEY ("A") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubmissionHelpers" ADD CONSTRAINT "_SubmissionHelpers_B_fkey" FOREIGN KEY ("B") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
