-- Succès « Spécial » : le chemin stocké portait un **accent** (`/game-data/achievements/spécial.png`).
--
-- Pourquoi cette migration : un accent dans un chemin d'asset est une bombe à retardement —
-- encodage de l'URL, cache d'un ancien 404 côté navigateur/CDN, mojibake d'un attribut HTML,
-- normalisation différente selon le système de fichiers. Mesure du 16/10/2026 : l'URL encodée
-- répondait 200, la base portait bien le chemin NFC, et le succès restait **noir** dans les
-- fiches interne et externe.
--
-- La donnée est alignée sur le nom **ASCII déjà présent** au dépôt (`special.png`, même MD5
-- que l'ancien `spécial.png`, qui est supprimé) — comme les 27 autres succès du dossier
-- (`conquerant.png`, `liberte.png`…). La règle d'affichage (`getAchievementIconUrl`) sert de
-- toute façon la forme ASCII : cette migration remet la **donnée** d'aplomb.
--
-- Idempotente : la condition ne matche plus une fois la ligne normalisée.
-- Écrite à la main (docs/agents/prisma-schema-change.md §0 — ce dépôt n'utilise pas `migrate dev`).

UPDATE "Challenge"
   SET "iconUrl" = '/game-data/achievements/special.png'
 WHERE slug = 'sp-cial'
   AND "iconUrl" IS DISTINCT FROM '/game-data/achievements/special.png';
