/**
 * Gardes — le bruit Sentry **attendu** ne doit pas créer d'Issue.
 *
 * Mesures du 09/11/2026 (Issues `JAVASCRIPT-NEXTJS-2M` et `-2N`) :
 * ① un **429 Metamob** était loggué en `error` à chaque pas ±1, alors que c'est un cas prévu
 *    (le client met sa file en pause via `retryAfterMs`) ;
 * ② le calendrier envoyait la clé API **chiffrée** à `/v1/kralove` ⇒ « Erreur 400 de l'API »
 *    (`decrypt` était utilisé partout ailleurs, pas ici).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("bruit Sentry — les cas attendus restent hors Issue", () => {
    it("un 429 Metamob est loggué en warn, et le calcul précède le log d'erreur", () => {
        const src = read("src/server/actions/ocre-actions.ts");
        expect(src).toContain('logger.warn("[updateUserMonsterQuantityAction] Metamob rate limit"');
        // Le `logger.error` ne doit plus précéder la distinction du cas : il vit dans le `else`.
        const guard = src.indexOf("const isMetamobRateLimit =");
        const errorLog = src.indexOf('logger.error("[updateUserMonsterQuantityAction] Error:"');
        expect(guard).toBeGreaterThan(-1);
        expect(errorLog).toBeGreaterThan(guard);
    });

    it("le calendrier déchiffre la clé Metamob avant l'amont (fin du 400)", () => {
        const calendar = read("src/server/actions/calendar-actions.ts");
        expect(calendar).toContain("decrypt(userProfile.metamobApiKey)");
        // Un échec Krala est une config utilisateur / un amont indisponible : warn, hors Sentry.
        expect(calendar).toContain('logger.warn("[Calendar] Failed to sync Krala counts in list"');
        expect(calendar).not.toContain('logger.error("[Calendar] Failed to sync Krala counts in list:');
    });

    it("les événements du dashboard déchiffrent aussi la clé", () => {
        const events = read("src/server/actions/event-actions.ts");
        expect(events).toContain("decrypt(userProfile.metamobApiKey)");
        expect(events).not.toContain("const apiKey = userProfile.metamobApiKey;");
    });
});
