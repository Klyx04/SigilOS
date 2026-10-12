/**
 * 🔍 Classification des erreurs Discord API pour le cron de sync membres.
 *
 * Certaines erreurs sont des ÉTATS DE CONFIG PERMANENTS (pas des pannes) :
 * - 404 Unknown Guild → le bot a été kické / la guilde a été supprimée
 * - 403 Forbidden → l'intent "Server Members" est coupé côté portail dev
 *
 * Les ignorer en warning (fail-soft) évite qu'une seule guilde fantôme
 * fasse échouer tout le cron toutes les 30 min. Les autres erreurs
 * (réseau, 5xx, rate-limit) restent des échecs : l'état est inconnu,
 * on ne doit PAS archiver silencieusement personne (fail-closed).
 *
 * Pur (aucune I/O) → testable unitairement.
 */
export function isGuildUnavailableError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err ?? "");
    if (/Discord API error:\s*404\b/.test(message)) return true;
    if (/Unknown Guild/i.test(message)) return true;
    if (/Discord API Forbidden\s*\(403\)/.test(message)) return true;
    return false;
}
