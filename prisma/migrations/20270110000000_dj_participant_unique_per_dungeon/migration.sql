-- Multi-donjons (#26) — « ❌ Erreur lors de l'inscription » au 2ᵉ donjon.
--
-- Cause racine mesurée : la contrainte d'unicité portait sur (postId, profileId),
-- donc une seule ligne par joueur et par post. Or le code applicatif est écrit
-- pour le multi depuis #26 : `internalJoinDjPost` filtre l'existence par
-- `dungeonIndex` (et refuse avec « Tu es déjà inscrit à ce donjon dans ce
-- groupe »), la capacité est comptée par donjon (#203), et les boutons Discord
-- portent l'index (`dj:apply:{postId}:{idx}`). Résultat : le 2ᵉ INSERT violait
-- l'unicité → exception Prisma (P2002) → `catch` → « Erreur lors de
-- l'inscription » (le refus *applicatif*, lui, a son propre message).
--
-- Contenu : suppression de l'index unique `DjSearchParticipant_postId_profileId_key`
-- (nom réel vérifié en base le 16/10/2026) et création de l'index unique
-- `(postId, profileId, dungeonIndex)` — la même forme que celle générée par
-- Prisma pour un `@@unique` à trois colonnes.
--
-- Aucune donnée réécrite : les lignes existantes ont `dungeonIndex = NULL` (posts
-- simples) ou un index de donjon valide, et les deux formes coexistent dans le
-- nouvel index.
--
-- ⚠️ Conséquence assumée (postgres) : un index unique où une colonne peut être
-- `NULL` **n'interdit pas** deux lignes `NULL` identiques. La règle « un seul
-- groupe par joueur » des posts simples reste donc portée par la garde
-- applicative (`internalJoinDjPost`, `joinDjPost`, `leaveDjPost`), jamais par la
-- base seule.
--
-- Écrite à la main, conformément à `docs/agents/prisma-schema-change.md` §0
-- (ce dépôt n'utilise pas `migrate dev`) : jouée par `prisma migrate deploy`.

DROP INDEX IF EXISTS "DjSearchParticipant_postId_profileId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "DjSearchParticipant_postId_profileId_dungeonIndex_key"
    ON "DjSearchParticipant" ("postId", "profileId", "dungeonIndex");
