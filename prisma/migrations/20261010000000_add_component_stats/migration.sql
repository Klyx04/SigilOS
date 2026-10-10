-- Marché — **jet par objet de lot** (correctif 10/10/2026).
--
-- Constat : un lot multiple (BUNDLE) ne pouvait porter aucun jet : `MarketListingStat`
-- est scopé par `listingId` (avec `@@unique[listingId, effectId, origin]`), donc deux
-- objets avec le même effet (ex. Vitalité) se télescopaient, et la création forçait
-- `stats: []`. Conséquence : aucune miniature de stats pour un équipement vendu en lot,
-- et les embeds Discord d'un lot partageaient tous la vignette du 1er objet.
--
-- Fondation ADDITIVE : nouvelle table `MarketListingComponentStat` (miroir de
-- `MarketListingStat`, scopée par `componentId`) + colonne `statsHash` sur l'objet
-- (clé de cache de la carte OG par objet, comme `MarketListing.statsHash`).
-- Aucune contrainte supprimée, aucun backfill (NULL = vente brute), rejouable.
-- La suppression d'un objet emporte son jet (`ON DELETE CASCADE`).

ALTER TABLE "MarketListingComponent" ADD COLUMN IF NOT EXISTS "statsHash" TEXT;

CREATE TABLE IF NOT EXISTS "MarketListingComponentStat" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "effectId" INTEGER NOT NULL,
    "characteristic" INTEGER,
    "label" TEXT NOT NULL,
    "naturalMin" INTEGER,
    "naturalMax" INTEGER,
    "actualValue" INTEGER NOT NULL,
    "origin" "MarketStatOrigin" NOT NULL DEFAULT 'NATIVE',
    "quality" "MarketStatQuality" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketListingComponentStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketListingComponentStat_componentId_effectId_origin_key"
    ON "MarketListingComponentStat" ("componentId", "effectId", "origin");

CREATE INDEX IF NOT EXISTS "MarketListingComponentStat_componentId_idx"
    ON "MarketListingComponentStat" ("componentId");

-- `ON DELETE CASCADE` idempotent : ne recrée la contrainte que si absente.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'MarketListingComponentStat_componentId_fkey'
    ) THEN
        ALTER TABLE "MarketListingComponentStat"
            ADD CONSTRAINT "MarketListingComponentStat_componentId_fkey"
            FOREIGN KEY ("componentId") REFERENCES "MarketListingComponent"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
