/**
 * 🔒 CRON AUTH HELPER
 *
 * Vérifie que la requête entrante provient bien du scheduler interne (crontab VPS)
 * en validant un secret partagé passé dans le header `x-cron-secret`.
 *
 * UTILISATION dans chaque route cron :
 *   import { verifyCronSecret } from "@/lib/cron-auth";
 *   if (!verifyCronSecret(req)) return new Response("Unauthorized", { status: 401 });
 *
 * CONFIGURATION côté VPS (crontab) :
 *   curl -s -H "x-cron-secret: $CRON_SECRET" https://sigilos.fr/api/cron/cleanup-proofs
 *
 * GÉNÉRATION DU SECRET (une fois, en SSH) :
 *   openssl rand -hex 32
 *   # Puis ajouter CRON_SECRET=<valeur> dans .env et docker-compose.prod.yml
 */

/**
 * Vérifie la signature du secret CRON via comparaison à temps constant
 * pour résister aux attaques de timing (timing attack).
 *
 * Accepte DEUX formats de header (compatibilité scripts existants) :
 *   - x-cron-secret: <secret>     (nouveau format, recommandé)
 *   - Authorization: Bearer <secret> (format legacy utilisé par maintenance.sh)
 */
export function verifyCronSecret(req: Request): boolean {
    const secret = process.env.CRON_SECRET;

    // Si le secret n'est pas configuré côté serveur → refuser par défaut (fail-closed)
    if (!secret || secret.length === 0) {
        console.error("[CRON] ⚠️  CRON_SECRET non configuré — toutes les requêtes CRON sont bloquées.");
        return false;
    }

    // Extraire le secret depuis le header, en acceptant deux formats :
    let incoming = req.headers.get("x-cron-secret");
    
    // Fallback : Authorization: Bearer <secret> (format legacy)
    if (!incoming) {
        const auth = req.headers.get("Authorization");
        if (auth && auth.startsWith("Bearer ")) {
            incoming = auth.slice(7);
        }
    }

    // Pas de header = refus immédiat
    if (!incoming) return false;

    // Comparaison à temps constant pour résister aux timing attacks
    // (un attaquant ne peut pas inférer la longueur correcte via le temps de réponse)
    if (incoming.length !== secret.length) return false;

    let mismatch = 0;
    for (let i = 0; i < secret.length; i++) {
        mismatch |= incoming.charCodeAt(i) ^ secret.charCodeAt(i);
    }
    return mismatch === 0;
}
