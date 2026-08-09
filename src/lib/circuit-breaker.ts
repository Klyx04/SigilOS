// =============================================================================
// CIRCUIT BREAKER — disjoncteur pour appels à des APIs tierces (I-15)
// =============================================================================
// Principe (comme un disjoncteur électrique) :
//   - CLOSED  (fermé)   : tout va bien, on appelle l'API normalement.
//   - OPEN     (ouvert)  : trop d'échecs consécutifs → on arrête d'appeler
//                          l'API pendant `recoveryTimeoutMs` (fail fast au lieu
//                          de marteler un serveur en panne).
//   - HALF_OPEN (entrouvert) : après le délai, on laisse passer UN seul essai
//                          pour vérifier si l'API est revenue.
//
// Règle du finding I-15 (l'implémentation précédente était inversée) :
//   - on incrémente le compteur SUR ÉCHEC,
//   - on réinitialise le compteur SUR SUCCÈS,
//   - on stocke bien un état closed/open/half-open.
//
// Fail-closed : tant que l'état est OPEN, on refuse l'appel (le code appelant
// renvoie son cache ou une erreur explicite — jamais une fausse réussite).
//
// Logs via `logger` (jamais console.*) — redaction auto des secrets.

import { logger } from "./logger";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
    /** Nom logique du disjoncteur (ex: "metamob") — utilisé dans les logs. */
    name: string;
    /** Nombre d'échecs consécutifs avant ouverture. Défaut : 5. */
    failureThreshold?: number;
    /** Durée (ms) pendant laquelle l'API reste ouverte avant un essai. Défaut : 30s. */
    recoveryTimeoutMs?: number;
}

/**
 * Disjoncteur par API tierce. Instance dédiée par service (Metamob, etc.).
 * Thread-safe au sein d'un même process (modules Next/worker en singleton).
 */
export class CircuitBreaker {
    public readonly name: string;
    public readonly failureThreshold: number;
    public readonly recoveryTimeoutMs: number;

    private state: CircuitState = "closed";
    private consecutiveFailures = 0;
    private openedAt = 0;

    constructor(options: CircuitBreakerOptions) {
        this.name = options.name;
        this.failureThreshold = Math.max(1, options.failureThreshold ?? 5);
        this.recoveryTimeoutMs = Math.max(0, options.recoveryTimeoutMs ?? 30_000);
    }

    /** État courant (read-only, pratique pour les tests/observabilité). */
    public getState(): CircuitState {
        return this.state;
    }

    public getConsecutiveFailures(): number {
        return this.consecutiveFailures;
    }

    /**
     * Doit-on laisser passer l'appel ?
     *  - closed → true
     *  - open, et pas encore arrivé au délai de récupération → false (fail fast)
     *  - open, délai écoulé → bascule en half-open et autorise UN essai
     */
    public allowCall(): boolean {
        if (this.state === "closed") return true;
        if (this.state === "half-open") return true; // un seul essai, on verra onFailure/onSuccess

        // state === "open"
        if (Date.now() >= this.openedAt + this.recoveryTimeoutMs) {
            this.state = "half-open";
            logger.info(`[CircuitBreaker:${this.name}] Passage en half-open — un essai autorisé pour vérifier la reprise.`);
            return true;
        }
        return false;
    }

    /** Appel réussi → on revient à zéro et on referme le circuit. */
    public onSuccess(): void {
        this.consecutiveFailures = 0;
        if (this.state !== "closed") {
            this.state = "closed";
            logger.info(`[CircuitBreaker:${this.name}] API de nouveau disponible — circuit refermé.`);
        }
    }

    /** Appel en échec → on compte ; si le seuil est atteint, on ouvre le circuit. */
    public onFailure(): void {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.failureThreshold) {
            if (this.state !== "open") {
                this.state = "open";
                this.openedAt = Date.now();
                logger.warn(
                    `[CircuitBreaker:${this.name}] ${this.consecutiveFailures} échecs consécutifs → circuit OUVERT pour ${this.recoveryTimeoutMs}ms.`
                );
            } else {
                // Déjà ouvert (ex. un essai half-open a re-échoué) → on prolonge la fenêtre.
                this.openedAt = Date.now();
            }
        }
    }

    /**
     * Helper pratique : exécute `fn` sous le disjoncteur.
     *  - si le circuit est ouvert → renvoie `onOpenFallback()` (le cache, ou fail-closed).
     *  - sinon exécute `fn`, onSuccess() si OK, onFailure() si throw (et re-throw).
     */
    public async execute<T>(
        fn: () => Promise<T>,
        onOpenFallback: () => T | Promise<T>
    ): Promise<T> {
        if (!this.allowCall()) {
            logger.warn(`[CircuitBreaker:${this.name}] Circuit ouvert — appel court-circuité (fallback).`);
            return onOpenFallback();
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }
}
