/**
 * ⏱️ `/valider-recrue` — ouverture et soumission dans les budgets Discord.
 *
 * Mesures du 25/10/2026 :
 * 1. Ouverture : la commande répond par une **modale** (`type: 9`), donc pas de
 *    `defer` possible à cette étape. Les lectures de pré-remplissage sont bornées et
 *    la résolution instantanée depuis `payload.data.resolved` garantit le nom Discord en 0 ms.
 * 2. Soumission : la soumission (`valrecrue:submit`) effectue des écritures DB et surtout
 *    des appels REST Discord (`addGuildMemberRole`, `removeGuildMemberRole`) qui peuvent
 *    largement dépasser 3 s (latence réseau, rate-limit 429). Pour éviter « L'application n'a pas répondu à temps »
 *    et la modale figée à l'écran, la soumission répond immédiatement par un ACK différé (`type: 5`),
 *    ferme la modale, exécute le traitement en arrière-plan, et met à jour l'interaction
 *    via `editInteractionMessage`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const ROUTE = "src/app/api/discord/interactions/route.ts";

function validerRecrueOpenBlock(): string {
    const source = readFileSync(ROUTE, "utf8");
    const start = source.indexOf('if (commandName === "valider-recrue")');
    expect(start, "bloc /valider-recrue introuvable").toBeGreaterThan(-1);
    const end = source.indexOf("type: 9, // MODAL", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

function validerRecrueSubmitBlock(): string {
    const source = readFileSync(ROUTE, "utf8");
    const start = source.indexOf('prefix === "valrecrue" && action === "submit"');
    expect(start, "bloc soumission valrecrue introuvable").toBeGreaterThan(-1);
    const marker = "return deferredResponse;";
    const end = source.indexOf(marker, start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + marker.length);
}

describe("/valider-recrue — ouverture de modale", () => {
    it("résout instantanément le membre Discord ciblé depuis payload.data.resolved (0 ms)", () => {
        const block = validerRecrueOpenBlock();
        expect(block).toContain("payload.data?.resolved?.users");
        expect(block).toContain("payload.data?.resolved?.members");
        expect(block).toContain("targetDiscordName");
    });

    it("borne les lectures de pré-remplissage avec `raceWithDeadline`", () => {
        const block = validerRecrueOpenBlock();
        expect(block).toContain("raceWithDeadline");
        expect(block).toContain("VALRECRUE_PREFILL_BUDGET_MS");
    });

    it("ouvre quand même la modale quand le budget est dépassé", () => {
        const block = validerRecrueOpenBlock();
        expect(block).toContain('prefillOutcome.status === "timeout"');
        expect(block).not.toContain('if (prefillOutcome.status === "timeout") {\n                    return');
    });

    it("ne refait pas d'appel Discord avant la réponse (aucun contrôle de permission bloquant)", () => {
        const block = validerRecrueOpenBlock();
        expect(block).not.toContain("await internalCheckPermission");
        expect(block).not.toContain("await fetchChannel");
    });
});

describe("/valider-recrue — soumission différée (garantie anti-timeout)", () => {
    it("répond immédiatement avec type 5 (deferred reply) et flags: 64", () => {
        const block = validerRecrueSubmitBlock();
        expect(block).toContain("type: 5");
        expect(block).toContain("flags: 64");
        expect(block).toContain("return deferredResponse;");
    });

    it("effectue les modifications de rôles Discord en arrière-plan sans bloquer l'ACK", () => {
        const block = validerRecrueSubmitBlock();
        expect(block).toContain("addGuildMemberRole");
        expect(block).toContain("removeGuildMemberRole");
        expect(block).toContain("editInteractionMessage(payload.application_id, payload.token");
    });

    it("publie l'embed de confirmation via editInteractionMessage", () => {
        const block = validerRecrueSubmitBlock();
        expect(block).toContain("embeds: [{");
        expect(block).toContain("title: `✅ Ligne registre complétée — <@${targetId}>`");
    });
});
