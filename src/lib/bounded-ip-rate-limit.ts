/**
 * Limiteur de débit IP borné, **fail-closed** quand la table est saturée.
 *
 * Extrait de `src/proxy.ts` (AUD-09, audit 13/11/2026) : l'ancien code
 * **autorisait** une nouvelle IP lorsque la Map atteignait son plafond
 * (`return true`), ce qui ouvrait un contournement par saturation.
 *
 * Le temps est injectable (`now`) pour tester les fenêtres sans horloge réelle.
 */
export interface BoundedIpRateLimit {
    allow(ip: string, limit: number, windowMs: number, now?: number): boolean;
    readonly size: number;
}

export function createBoundedIpRateLimit(maxEntries: number): BoundedIpRateLimit {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
        throw new Error("maxEntries must be a positive integer");
    }

    const counters = new Map<string, { count: number; reset: number }>();

    return {
        allow(ip: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
            const entry = counters.get(ip);

            if (!entry || now > entry.reset) {
                if (counters.size >= maxEntries) {
                    for (const [key, value] of counters) {
                        if (value.reset < now) counters.delete(key);
                    }
                }
                // Fail-closed : une table saturée ne doit jamais ouvrir la porte.
                if (counters.size >= maxEntries) return false;
                counters.set(ip, { count: 1, reset: now + windowMs });
                return true;
            }

            if (entry.count >= limit) return false;
            entry.count += 1;
            return true;
        },
        get size() {
            return counters.size;
        },
    };
}
