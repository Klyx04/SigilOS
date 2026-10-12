-- Slug public des donjons (/boss/<slug> au lieu de /boss/<cuid>).
-- 1. Colonne ajoutee nullable, remplie, puis verrouillee (NOT NULL + unique) dans la MEME migration :
--    aucun intervalle pendant lequel une fiche publique serait sans slug.
-- 2. Slug = bossName slugifie (accents deplies, non alphanumerique -> tiret, tirets compactes/rognes).
-- 3. Homonymes : suffixe ordinal deterministe (-2, -3...) dans l ordre (dofusdbId NULLS LAST, level, id).
-- ATTENTION FORMAT : une instruction par ligne, commentaires ASCII. Sinon le schema-engine de
-- Prisma 7 part en boucle CPU a 100 % sans executer le SQL, en gardant le verrou advisory
-- (migrate deploy parait fige, puis P1002 au redemarrage). Reproduit le 19/09/2026.
ALTER TABLE "Dungeon" ADD COLUMN IF NOT EXISTS "slug" TEXT;
UPDATE "Dungeon" SET "slug" = trim(both '-' from regexp_replace(regexp_replace(translate(lower(replace(replace("bossName", 'æ', 'ae'), 'œ', 'oe')), 'àâäáãåçéèêëîïíìôöóòõùûüúÿñ', 'aaaaaaceeeeiiiiooooouuuuyn'), '[^a-z0-9]+', '-', 'g'), '-+', '-', 'g')) WHERE "slug" IS NULL;
WITH ranked AS (SELECT id, "slug", row_number() OVER (PARTITION BY "slug" ORDER BY "dofusdbId" NULLS LAST, level, id) AS rn FROM "Dungeon") UPDATE "Dungeon" d SET "slug" = r."slug" || '-' || r.rn FROM ranked r WHERE d.id = r.id AND r.rn > 1;
ALTER TABLE "Dungeon" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Dungeon_slug_key" ON "Dungeon"("slug");