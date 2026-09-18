/*
  #140 décommissionné (17/09/2026) — la landing affiche des visuels STATIQUES
  (`src/lib/landing-figures.ts` → `public/assets/screenshots/`), elle ne lit
  plus aucune ligne en base. La table `LandingScreen` (interface God
  `/god/landing`, upload/suppression à la volée) n'avait donc plus aucun
  lecteur : elle est supprimée ici, avec la ligne « hero » résiduelle.

  `IF EXISTS` : blinde le cas d'un environnement où la migration
  `20260905000000_add_landing_screen` n'aurait jamais été appliquée
  (même esprit que les `ADD COLUMN IF NOT EXISTS` de la PR #614).
*/
-- DropTable
DROP TABLE IF EXISTS "LandingScreen";
