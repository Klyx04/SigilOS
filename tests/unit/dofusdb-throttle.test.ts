/**
 * 🚦 Limite locale DofusDB — règles PURES (chantier A2, 28/09/2026).
 *
 * Mesure d'origine : la capture du Tableau God affichait « DofusDB a renvoyé HTTP 429 »
 * (*Items & ressources*) et « Référentiel incomplet (page DofusDB en échec) » alors que le 429
 * était rendu par **notre** limiteur (30 req/min partagées) — et que la cadence des siphons
 * frôlait ce plafond (28,6 req/min) tandis que le collecteur de référentiels n'avait
 * **aucune** cadence (rafale de pages). Ces fonctions portent la règle qui rend le message
 * honnête et laisse une marge réelle.
 */

import { describe, expect, it } from "vitest";
import {
    DOFUSDB_RATE_LIMIT,
    DOFUSDB_RATE_WINDOW_MS,
    DOFUSDB_SAFETY_MARGIN,
    DOFUSDB_THROTTLE_MAX_WAIT_MS,
    DOFUSDB_THROTTLE_MIN_WAIT_MS,
    LOCAL_THROTTLE_HEADER,
    LOCAL_THROTTLE_VALUE,
    budgetPauseMs,
    dofusDbFailureMessage,
    isLocalThrottle,
    throttleWaitMs,
} from "@/lib/dofusdb-throttle";

const headers = (entries: Record<string, string>) => new Headers(entries);

describe("budgetPauseMs — cadence avec marge", () => {
    it("garde plus de 10 % de marge sur le budget partagé (2 400 ms ⇒ 25 req/min)", () => {
        const pause = budgetPauseMs();
        expect(pause).toBe(2_400);
        // Vérification par la marge, pas par le nombre : 60 000 / 2 400 = 25 req/min sur 30.
        const requestsPerMinute = DOFUSDB_RATE_WINDOW_MS / pause;
        expect(requestsPerMinute).toBeLessThanOrEqual(DOFUSDB_RATE_LIMIT * (1 - DOFUSDB_SAFETY_MARGIN));
        // L'ancienne cadence (2 100 ms) frôlait le plafond : c'est ce qui faisait déborder la fenêtre.
        expect(DOFUSDB_RATE_WINDOW_MS / 2_100).toBeGreaterThan(DOFUSDB_RATE_LIMIT * (1 - DOFUSDB_SAFETY_MARGIN));
    });

    it("reste cohérent si l'on change le budget (règle, pas constante magique)", () => {
        expect(budgetPauseMs(10, 10_000, 0.2)).toBe(1_250); // 8 req/10 s
        expect(budgetPauseMs(1, 60_000, 0)).toBe(60_000);
        expect(budgetPauseMs(30, 60_000, 0.9)).toBe(20_000); // la marge reste bornée à 90 %
    });
});

describe("isLocalThrottle — le refus est NOTRE limiteur", () => {
    it("vrai seulement avec l'en-tête `x-sigilos-throttle: local`", () => {
        expect(isLocalThrottle({ headers: headers({ [LOCAL_THROTTLE_HEADER]: LOCAL_THROTTLE_VALUE }) })).toBe(true);
        expect(isLocalThrottle({ headers: headers({ [LOCAL_THROTTLE_HEADER]: "remote" }) })).toBe(false);
        // Un 429 de DofusDB lui-même ne porte aucun en-tête de ce nom ⇒ jamais confondu.
        expect(isLocalThrottle({ headers: headers({ "retry-after": "30" }) })).toBe(false);
        expect(isLocalThrottle(null)).toBe(false);
        expect(isLocalThrottle(undefined)).toBe(false);
    });
});

describe("throttleWaitMs — combien de temps attendre avant de rejouer", () => {
    it("honore le `retry-after` posé par notre limiteur (secondes)", () => {
        expect(throttleWaitMs({ headers: headers({ "retry-after": "3" }) })).toBe(3_000);
    });

    it("sans `retry-after` : reste de la fenêtre courante, borné", () => {
        // Fenêtre de 60 s, à 15 s dans la fenêtre ⇒ ~45 s restantes ⇒ borné à 20 s.
        expect(throttleWaitMs(null, 15_000, DOFUSDB_RATE_WINDOW_MS)).toBe(DOFUSDB_THROTTLE_MAX_WAIT_MS);
        // À 58 s dans la fenêtre ⇒ 2 s + marge de 250 ms ⇒ sous le plafond.
        expect(throttleWaitMs(null, 58_000, DOFUSDB_RATE_WINDOW_MS)).toBe(2_250);
        // Jamais moins que le minimum (une fenêtre qui vient de tourner ne fait pas boucler serré).
        expect(throttleWaitMs({ headers: headers({ "retry-after": "0" }) }, 0, 60_000))
            .toBeGreaterThanOrEqual(DOFUSDB_THROTTLE_MIN_WAIT_MS);
        // Valeur illisible ⇒ repli sur le reste de fenêtre, jamais `NaN`.
        expect(Number.isFinite(throttleWaitMs({ headers: headers({ "retry-after": "bientôt" }) }, 30_000))).toBe(true);
    });
});

describe("dofusDbFailureMessage — cause nommée", () => {
    it("ne fait jamais passer notre budget pour une panne de DofusDB", () => {
        const local = dofusDbFailureMessage(429, true);
        expect(local).toContain("Limite locale atteinte");
        expect(local).toContain("30 req/60 s");
        expect(local).toContain("reprise au prochain passage");
        expect(local).not.toContain("DofusDB a renvoyé");

        // Une vraie panne distante garde son message historique (aucune régression de lecture).
        expect(dofusDbFailureMessage(503, false)).toBe("DofusDB a renvoyé HTTP 503");
    });
});
