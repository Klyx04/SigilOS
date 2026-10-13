-- Série de sondages programmés : identifiant partagé par toutes les occurrences
-- d'une même répétition (la première porte le sien, les suivantes le recopient).
--
-- Additif pur, aucune réécriture de données : les créneaux existants ont
-- `seriesId` nul et reçoivent leur série **à leur prochaine publication**
-- (le moteur pose `seriesId = id du créneau` quand une répétition est active).
ALTER TABLE "ScheduledPoll" ADD COLUMN "seriesId" TEXT;

-- Retrouver l'occurrence précédente d'une série (clôture avant la suivante).
CREATE INDEX "ScheduledPoll_guildId_seriesId_idx" ON "ScheduledPoll"("guildId", "seriesId");
