-- CreateTable
CREATE TABLE "_MonsterFamilyToZone" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MonsterFamilyToZone_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_MonsterFamilyToZone_B_index" ON "_MonsterFamilyToZone"("B");

-- AddForeignKey
ALTER TABLE "_MonsterFamilyToZone" ADD CONSTRAINT "_MonsterFamilyToZone_A_fkey" FOREIGN KEY ("A") REFERENCES "MonsterFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MonsterFamilyToZone" ADD CONSTRAINT "_MonsterFamilyToZone_B_fkey" FOREIGN KEY ("B") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
