-- Traductions EN du journal des mises a jour (facultatives).
-- NULL = repli automatique sur le FR a l'affichage
-- (localizeChangelogEntry dans src/server/actions/changelog-actions.ts).
ALTER TABLE "ChangelogEntry"
    ADD COLUMN IF NOT EXISTS "titleEn" TEXT,
    ADD COLUMN IF NOT EXISTS "summaryEn" TEXT,
    ADD COLUMN IF NOT EXISTS "contentEn" TEXT;
