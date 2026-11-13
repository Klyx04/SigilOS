-- 🧩 Référentiel des panoplies (DofusDB `/item-sets`) — lot « stuff & variantes », 26/10/2026.
--
-- **Pourquoi** : le payload Dofusbook ne contient que le **palier actif** d'une panoplie.
-- Recalculer les bonus quand une variante change une pièce exige donc de stocker les
-- **paliers complets** (`tiers`), sinon aucune variante ne peut être corrigée sans approximation.
--
-- **Contenu** : une table de référence (`id` = id DofusDB, comme `GameEffect` /
-- `GameCharacteristic`), ses paliers normalisés en JSONB et les ids Ankama de ses pièces.
-- Aucune donnée existante n'est lue ni réécrite ; la table est remplie par le siphon
-- (`src/lib/item-sets-siphon.ts`).
--
-- **Pourquoi à la main** : ce dépôt n'utilise pas `migrate dev` (base locale en drift, cf.
-- `docs/agents/prisma-schema-change.md` §0) ; les migrations sont additives et idempotentes.

CREATE TABLE IF NOT EXISTS "GameItemSet" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "itemsIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "tiers" JSONB NOT NULL,
    "dataHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameItemSet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GameItemSet_name_idx" ON "GameItemSet"("name");
