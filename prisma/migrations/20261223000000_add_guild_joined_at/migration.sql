-- 📋 Registre Membres & Recrutement — date d'arrivée en guilde saisie à la main.
-- Additive et idempotente : repli = createdAt (aucune donnée touchée, NULL = non renseigné).
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "guildJoinedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "UserProfile_guildId_guildJoinedAt_idx" ON "UserProfile"("guildId", "guildJoinedAt");
