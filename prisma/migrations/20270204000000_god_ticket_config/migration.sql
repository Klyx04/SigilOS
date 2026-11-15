-- G4 (God) — configuration **dédiée** du module support.
--
-- Décision du 14/11/2026 (route 2) : le module d'exploitation a sa propre
-- configuration, séparée du moteur de guilde (`TicketGuildConfig`). Aucun
-- identifiant Discord n'est écrit dans le code : serveur, salon, rôles et
-- catégories vivent dans `GodTicketConfig` / `GodTicketCategory`, réglés depuis
-- `/god/ticket-bot`.
--
-- Contenu :
-- ① deux tables neuves (configuration singleton + catégories éditables) ;
-- ② `SupportTicket.categoryKey` (référence facultative) et `SupportTicket.csatRating` ;
-- ③ seed des quatre catégories historiques, puis backfill des tickets existants ;
-- ④ contrainte de plage sur la note de satisfaction (1..5).
--
-- Migration **additive** : aucune colonne supprimée, aucun champ rendu
-- obligatoire, aucune ligne de ticket modifiée hors `categoryKey` (backfill).
-- Rejouable (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) et écrite à la main :
-- ce dépôt n'utilise pas `migrate dev` (cf. docs/agents/prisma-schema-change.md §0).

CREATE TABLE IF NOT EXISTS "GodTicketConfig" (
    "id"               TEXT        NOT NULL,
    "supportGuildId"   TEXT,
    "supportChannelId" TEXT,
    "staffRoleIds"     TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notifyRoleIds"    TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "namingPattern"    TEXT        NOT NULL DEFAULT '🎫-{num}-{author}',
    "closePolicy"      "TicketClosePolicy" NOT NULL DEFAULT 'STAFF_OR_CREATOR',
    "archiveOnClose"   BOOLEAN     NOT NULL DEFAULT true,
    "csatEnabled"      BOOLEAN     NOT NULL DEFAULT false,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "updatedBy"        TEXT,
    CONSTRAINT "GodTicketConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GodTicketCategory" (
    "id"             TEXT        NOT NULL,
    "key"            TEXT        NOT NULL,
    "label"          TEXT        NOT NULL,
    "emoji"          TEXT        NOT NULL DEFAULT '🎫',
    "color"          TEXT        NOT NULL DEFAULT '#6366f1',
    "legacyCategory" "TicketCategory",
    "order"          INTEGER     NOT NULL DEFAULT 0,
    "isEnabled"      BOOLEAN     NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GodTicketCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GodTicketCategory_key_key"
    ON "GodTicketCategory" ("key");

CREATE INDEX IF NOT EXISTS "GodTicketCategory_isEnabled_order_idx"
    ON "GodTicketCategory" ("isEnabled", "order");

ALTER TABLE "SupportTicket"
    ADD COLUMN IF NOT EXISTS "categoryKey" TEXT,
    ADD COLUMN IF NOT EXISTS "csatRating" INTEGER;

-- Les quatre catégories de départ reprennent exactement les libellés, emojis et
-- couleurs des constantes historiques (`ticket-actions.ts`). Leurs clés sont
-- **stables** : elles vivent dans les `custom_id` Discord.
INSERT INTO "GodTicketCategory"
    ("id", "key", "label", "emoji", "color", "legacyCategory", "order", "isEnabled", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::text, 'acces', 'Demande d''accès', '🔑', '#10b981', 'ACCESS_REQUEST', 0,  true, now(), now()),
    (gen_random_uuid()::text, 'bug',   'Signaler un bug', '🐛', '#ef4444', 'BUG_REPORT',     10, true, now(), now()),
    (gen_random_uuid()::text, 'idee',  'Proposer une idée', '💡', '#8b5cf6', 'FEATURE_REQUEST', 20, true, now(), now()),
    (gen_random_uuid()::text, 'autre', 'Autre demande', '📩', '#6366f1', 'OTHER',           30, true, now(), now())
ON CONFLICT ("key") DO NOTHING;

-- Backfill des tickets existants : chaque type historique retrouve sa clé.
-- Aucune autre colonne n'est touchée.
UPDATE "SupportTicket"
SET "categoryKey" = CASE "category"::text
    WHEN 'ACCESS_REQUEST' THEN 'acces'
    WHEN 'BUG_REPORT' THEN 'bug'
    WHEN 'FEATURE_REQUEST' THEN 'idee'
    ELSE 'autre'
END
WHERE "categoryKey" IS NULL;

DO $$
BEGIN
    ALTER TABLE "SupportTicket"
        ADD CONSTRAINT "SupportTicket_categoryKey_fkey"
        FOREIGN KEY ("categoryKey") REFERENCES "GodTicketCategory"("key")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE "SupportTicket"
        ADD CONSTRAINT "SupportTicket_csatRating_check"
        CHECK ("csatRating" IS NULL OR ("csatRating" >= 1 AND "csatRating" <= 5));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "SupportTicket_categoryKey_idx"
    ON "SupportTicket" ("categoryKey");
