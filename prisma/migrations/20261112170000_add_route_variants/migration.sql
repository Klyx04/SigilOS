-- Lot 4 (12/11/2026) — variante de texte par camp sur une même quête.
-- Additif : colonne nullable, aucune donnée existante touchée.
ALTER TABLE "GuideSequence" ADD COLUMN "routeVariants" JSONB;
