-- 🔎 Index composites du journal d'audit (audit croisé du 24/09/2026).
--
-- Les deux écrans God filtrent désormais EN BASE :
--   • `isGodLog` — périmètre plateforme vs guilde (`scope=platform|guild`) ;
--   • la catégorie d'action (`action IN (…)` pour la sécurité, `NOT IN` sinon).
-- La pagination (`orderBy createdAt DESC`) reste servie par le second membre.
--
-- Migration ADDITIVE et NON DESTRUCTIVE : deux `CREATE INDEX` (concurrents non
-- requis, `AuditLog` reste petite), aucune donnée lue ni modifiée.
CREATE INDEX IF NOT EXISTS "AuditLog_isGodLog_createdAt_idx"
    ON "AuditLog"("isGodLog", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_guildId_isGodLog_createdAt_idx"
    ON "AuditLog"("guildId", "isGodLog", "createdAt");
