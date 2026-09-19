-- Slug public des donjons (`/boss/<slug>` au lieu de `/boss/<cuid>`).
--
-- 1. Colonne ajoutée nullable, remplie, puis verrouillée (NOT NULL + unique)
--    dans la MÊME migration : aucun intervalle pendant lequel une fiche
--    publique serait sans slug.
-- 2. Slug = `bossName` slugifié (accents français dépliés, tout caractère non
--    alphanumérique → '-', tirets compactés et rognés).
-- 3. Homonymes (« Minotoror », « Comte Harebourg ») : suffixe ordinal
--    déterministe (`-2`, `-3`…) dans l'ordre (dofusdbId NULLS LAST, level, id).
--    Vérifié sur les 134 donjons de la base de développement : 0 doublon,
--    0 collision avec `Titan.slug` et `Bounty.slug`.
--
-- ⚠️ Le même algorithme existe en TypeScript (`src/lib/boss-slug.ts`) pour les
-- créations futures (God / siphon) : les deux doivent rester alignés.

ALTER TABLE "Dungeon" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "Dungeon" SET "slug" = trim(both '-' from regexp_replace(regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
        lower("bossName"),
        'à','a'), 'â','a'), 'ä','a'), 'á','a'), 'ã','a'), 'å','a'), 'æ','ae'), 'ç','c'), 'é','e'), 'è','e'), 'ê','e'), 'ë','e'),
        'î','i'), 'ï','i'), 'í','i'), 'ì','i'), 'ô','o'), 'ö','o'), 'ó','o'), 'ò','o'), 'õ','o'), 'œ','oe'), 'ù','u'), 'û','u'), 'ü','u'), 'ú','u'), 'ÿ','y'), 'ñ','n'),
        '[^a-z0-9]+', '-', 'g'), '-+', '-', 'g'))
 WHERE "slug" IS NULL;

WITH ranked AS (
    SELECT id, "slug", row_number() OVER (
               PARTITION BY "slug"
               ORDER BY "dofusdbId" NULLS LAST, level, id
           ) AS rn
      FROM "Dungeon"
)
UPDATE "Dungeon" d SET "slug" = r."slug" || '-' || r.rn
  FROM ranked r
 WHERE d.id = r.id AND r.rn > 1;

ALTER TABLE "Dungeon" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Dungeon_slug_key" ON "Dungeon"("slug");
