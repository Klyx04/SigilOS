-- 🧺 Module « Marché » — LOT MULTIPLE (décision user du 14/09/2026)
--
-- Option A retenue par le user : **un message Discord par objet** + **un prix
-- par objet**. Cette migration pose les FONDATIONS du schéma (étape 1 du plan
-- `src/temp/refonte-marche/PLAN-LOT-MULTIPLE.md`).
--
-- Migration IDEMPOTENTE (rejouable sans dégât) : `IF NOT EXISTS` partout où
-- PostgreSQL le permet, blocs `DO $$ … EXCEPTION WHEN duplicate_object` pour les
-- types énumérés. **Aucune opération destructive**, aucun `NOT NULL` sur une
-- table peuplée, aucun backfill nécessaire (les annonces existantes gardent
-- `componentId = NULL` et `status = 'AVAILABLE'` sur leurs composants).
--
-- ⚠️ Ce fichier ne change PAS l'unicité de `MarketDiscordMessage.listingId`
-- (`@unique` conservé) : le passage à « une ligne par objet » (index unique
-- `(listingId, componentId)`) se fera dans le commit Discord, avec le code qui
-- l'accompagne — un schéma non compilable n'a rien à faire dans `dev`.

-- ── 1) Type d'annonce : lot multiple ────────────────────────────────────────
DO $$
BEGIN
    ALTER TYPE "MarketListingType" ADD VALUE IF NOT EXISTS 'BUNDLE';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ── 2) Statut d'un objet de lot ─────────────────────────────────────────────
DO $$
BEGIN
    CREATE TYPE "MarketComponentStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ── 3) `MarketListingComponent` : prix par objet + statut + horodatages ─────
ALTER TABLE "MarketListingComponent" ADD COLUMN IF NOT EXISTS "priceKamas" INTEGER;
ALTER TABLE "MarketListingComponent" ADD COLUMN IF NOT EXISTS "status" "MarketComponentStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "MarketListingComponent" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3);
ALTER TABLE "MarketListingComponent" ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "MarketListingComponent_listingId_status_idx"
    ON "MarketListingComponent" ("listingId", "status");

-- ── 4) `MarketReservation` : réservation ciblant UN objet ───────────────────
ALTER TABLE "MarketReservation" ADD COLUMN IF NOT EXISTS "componentId" TEXT;
CREATE INDEX IF NOT EXISTS "MarketReservation_componentId_status_idx"
    ON "MarketReservation" ("componentId", "status");
DO $$
BEGIN
    ALTER TABLE "MarketReservation"
        ADD CONSTRAINT "MarketReservation_componentId_fkey"
        FOREIGN KEY ("componentId") REFERENCES "MarketListingComponent"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ── 5) `MarketDiscordMessage` : un message par objet (option A) ─────────────
ALTER TABLE "MarketDiscordMessage" ADD COLUMN IF NOT EXISTS "componentId" TEXT;
CREATE INDEX IF NOT EXISTS "MarketDiscordMessage_componentId_idx"
    ON "MarketDiscordMessage" ("componentId");
DO $$
BEGIN
    ALTER TABLE "MarketDiscordMessage"
        ADD CONSTRAINT "MarketDiscordMessage_componentId_fkey"
        FOREIGN KEY ("componentId") REFERENCES "MarketListingComponent"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
