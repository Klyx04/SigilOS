-- ============================================================================
-- Notifications — asset de l'objet annoncé (icône de membre + illustration)
-- ============================================================================
-- POURQUOI : une notification du dashboard n'affichait qu'un picto de **catégorie**
-- (missions, donjons, marché…). L'utilisateur veut voir **quoi** est annoncé : l'illustration
-- du donjon validé, l'icône du Dofus, l'objet du marché. La table `Notification` ne portait
-- aucune référence d'image — impossible de la déduire du `link` (qui n'est qu'un chemin
-- d'écran, sans identifiant d'entité).
--
-- CE QU'ELLE CONTIENT : deux colonnes **NULLABLES** sur `Notification`.
--   · "imageUrl"  — chemin servi par l'app (`/api/assets-dofus/...` auto-siphonné, ou un
--                   asset local du jeu). `null` ⇒ repli sur le picto de la catégorie.
--   · "imageKind" — ce que l'image représente (`DUNGEON`, `DOFUS`, `ITEM`, `MONSTER`,
--                   `SUCCESS`, `MARKET`) : sert au rendu et documente la source.
--
-- POURQUOI ÉCRITE À LA MAIN : cf. `docs/agents/prisma-schema-change.md` §0 — ce dépôt
-- n'utilise pas `migrate dev` (la base locale est en drift sur une migration absente du
-- dépôt) ; les migrations récentes sont écrites à la main, additives et idempotentes.
--
-- AUCUNE DONNÉE RÉÉCRITE : les lignes existantes restent à `NULL` et retombent sur le
-- comportement d'avant (picto de catégorie). Réversible sans perte.
-- ============================================================================

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "imageKind" TEXT;
