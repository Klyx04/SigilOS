-- 📋 Registre : commentaires du staff multiples (10 max), horodatés et signés.
-- La note unique `staffNotes` est reprise comme premier commentaire de chaque
-- membre, puis la colonne disparaît : aucune donnée perdue, une seule notion.
CREATE TABLE IF NOT EXISTS "MemberRegistryComment" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRegistryComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MemberRegistryComment_profileId_createdAt_idx" ON "MemberRegistryComment"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "MemberRegistryComment_guildId_idx" ON "MemberRegistryComment"("guildId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberRegistryComment_profileId_fkey') THEN
        ALTER TABLE "MemberRegistryComment"
            ADD CONSTRAINT "MemberRegistryComment_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Reprise : la note unique devient le premier commentaire du membre.
INSERT INTO "MemberRegistryComment" ("id", "guildId", "profileId", "authorUserId", "authorName", "body", "createdAt")
SELECT gen_random_uuid()::text, "guildId", "id", NULL, 'Reprise du registre', "staffNotes", COALESCE("updatedAt", NOW())
FROM "UserProfile"
WHERE "staffNotes" IS NOT NULL AND btrim("staffNotes") <> '';

ALTER TABLE "UserProfile" DROP COLUMN IF EXISTS "staffNotes";
