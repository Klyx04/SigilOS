-- Récurrence des sondages programmés (« tous les N jours / semaines / mois »).
--
-- Pourquoi une migration **séparée** et non un ajout à 20270102000000 : cette
-- dernière a **déjà été appliquée** (déploiement bêta du merge #948). Modifier un
-- fichier de migration déjà appliqué change son **checksum** ⇒ Prisma refuse de
-- déployer (« was modified after it was applied »). Les colonnes de récurrence
-- vivent donc dans leur propre migration, additive et idempotente.
--
-- SQL généré par `prisma migrate diff --from-schema <avant> --to-schema` (aucune
-- dérive : c'est exactement ce que le datamodel décrit).

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ScheduledRepeatUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "ScheduledPoll" ADD COLUMN IF NOT EXISTS     "repeatEvery" INTEGER,
ADD COLUMN IF NOT EXISTS     "repeatUnit" "ScheduledRepeatUnit",
ADD COLUMN IF NOT EXISTS     "repeatUntil" TIMESTAMP(3);
