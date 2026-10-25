/**
 * ⏱️ `/valider-recrue` — la modale doit partir en **moins de 3 s**.
 *
 * Mesure du 25/10/2026 : la commande répond par une **modale** (`type: 9`), donc pas de
 * `defer` possible ; tout ce qui s'exécute avant la réponse consomme le budget Discord.
 * La cause des deux messages « n'a pas répondu à temps » / « L'application ne répond plus »
 * ne peut pas être un ACK manquant : le pré-remplissage (serveur, profil, registre) doit
 * être **borné**.
 *
 * Ce verrou est statique et volontairement simple : il casse si quelqu'un rebranche un
 * `await` non borné dans ce bloc.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const ROUTE = "src/app/api/discord/interactions/route.ts";

function validerRecrueBlock(): string {
    const source = readFileSync(ROUTE, "utf8");
    const start = source.indexOf('if (commandName === "valider-recrue")');
    expect(start, "bloc /valider-recrue introuvable").toBeGreaterThan(-1);
    // Fin du bloc : la réponse modale réelle (`type: 9, // MODAL`), pas la mention en commentaire.
    const end = source.indexOf("type: 9, // MODAL", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

describe("/valider-recrue — budget de réponse", () => {
    it("borne les lectures de pré-remplissage avec `raceWithDeadline`", () => {
        const block = validerRecrueBlock();
        expect(block).toContain("raceWithDeadline");
        expect(block).toContain("VALRECRUE_PREFILL_BUDGET_MS");
    });

    it("ouvre quand même la modale quand le budget est dépassé", () => {
        const block = validerRecrueBlock();
        expect(block).toContain('prefillOutcome.status === "timeout"');
        // La modale est rendue dans tous les cas (aucun `return` sec sur le timeout).
        expect(block).not.toContain('if (prefillOutcome.status === "timeout") {\n                    return');
    });

    it("ne refait pas d'appel Discord avant la réponse (aucun contrôle de permission bloquant)", () => {
        const block = validerRecrueBlock();
        // On cherche des **appels**, pas les mentions en commentaire (le commentaire cite l'ancien code).
        expect(block).not.toContain("await internalCheckPermission");
        expect(block).not.toContain("await fetchChannel");
    });
});
