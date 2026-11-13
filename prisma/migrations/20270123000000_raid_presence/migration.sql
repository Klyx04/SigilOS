-- Registre de présence des raids — R1 « no-show » (PLAN-RAID L2, 31/10/2026).
--
-- POURQUOI : la présence vivait uniquement dans `GuildEvent.metadata.raidPresentUserIds`, un JSON
-- **non requêtable**. On ne pouvait donc ni compter les no-shows sur 90 jours, ni corriger un statut
-- après coup, ni prouver ce qui avait été débité. Le registre devient une table : une ligne par
-- inscrit au moment de la clôture, écrite par `completeRaidEvent`, supprimée par le undo (annuler
-- une clôture doit ramener l'état d'avant, registre compris).
--
-- CONTENU :
--   · enum `RaidPresenceStatus` (PRESENT / PREVENU / EXCUSE / NO_SHOW) ;
--   · table `RaidPresence` : `guildId` (= GuildConfig.id), `eventId`, `userId`, `status`,
--     `recordedBy` (clôture ou correction d'un officier), horodatages ;
--   · unicité `(eventId, userId)` — une seule décision par inscrit et par raid ;
--   · index `(guildId, createdAt)` — compteur glissant 90 jours et purge, sans scan complet ;
--   · FK `eventId` et `userId` en cascade (supprimer le raid ou le compte efface le registre).
-- Aucune donnée existante n'est réécrite : les raids déjà clôturés gardent leur JSON, le registre
-- ne concerne que les clôtures postérieures.
--
-- ÉCRITE À LA MAIN : `prisma migrate dev` est inutilisable sur cet historique local (migration
-- absente du dépôt, base en drift) — cf. docs/agents/prisma-schema-change.md §0.
-- Additive et idempotente : rejouable sans erreur.

DO $$ BEGIN
    CREATE TYPE "RaidPresenceStatus" AS ENUM ('PRESENT', 'PREVENU', 'EXCUSE', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RaidPresence" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RaidPresenceStatus" NOT NULL DEFAULT 'PRESENT',
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RaidPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RaidPresence_eventId_userId_key"
    ON "RaidPresence"("eventId", "userId");

CREATE INDEX IF NOT EXISTS "RaidPresence_guildId_createdAt_idx"
    ON "RaidPresence"("guildId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "RaidPresence" ADD CONSTRAINT "RaidPresence_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "GuildEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RaidPresence" ADD CONSTRAINT "RaidPresence_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
