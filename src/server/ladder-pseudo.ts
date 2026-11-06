/**
 * Pseudo Dofus — **vérification auprès du worker ladder Ankama** (source unique).
 *
 * Extrait de `profile-actions.ts` le 06/11/2026 : le profil **interne** et l'espace
 * **visiteur** lisent la même mesure. Fail-open assumé : `null` = service indisponible
 * (URL absente, timeout, réponse non-2xx) ⇒ on n'empêche pas l'enregistrement, on dit
 * seulement que la vérification n'a pas pu être faite.
 *
 * Aucun log ici : le pseudo est une donnée personnelle, l'appelant décide de ce qu'il trace.
 */

export type LadderPseudoCheck = boolean | null;

export async function checkPseudoExistsOnLadder(pseudo: string, serverId: string): Promise<LadderPseudoCheck> {
    const WORKER_URL = process.env.DOFUS_LADDER_WORKER_URL;
    const WORKER_SECRET = process.env.DOFUS_LADDER_WORKER_KEY || process.env.DOFUS_LADDER_WORKER_SECRET;

    if (!WORKER_URL) return null; // Service indisponible → fail-open (ne bloque pas)

    try {
        const headers: Record<string, string> = { Accept: "application/json" };
        if (WORKER_SECRET) headers["X-SigilOS-Key"] = WORKER_SECRET;

        const url = `${WORKER_URL}?server_id=${encodeURIComponent(serverId)}&name=${encodeURIComponent(pseudo)}&type=general`;
        const res = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(5000),
            cache: "no-store",
        });

        if (!res.ok) return null; // Réseau/worker en échec → fail-open
        const data = await res.json().catch(() => null);
        return !!(data?.success || data?.found);
    } catch {
        return null; // Timeout/crash → fail-open
    }
}
