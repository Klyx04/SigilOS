/**
 * Garde de câblage (lecture source) — **events Kralamoure : source de vérité Metamob**.
 *
 * Décision user du 18/09/2026 : un event Kralamoure est **importé de Metamob** (les
 * inscrits ne sont pas des `UserProfile` SigilOS). Deux actions de la modale
 * n'avaient donc aucun sens et échouaient côté serveur :
 *  - « Terminer l'event » (la clôture vit sur Metamob) ;
 *  - l'**expulsion d'un participant** (`kickParticipant` → « PARTICIPANT
 *    INTROUVABLE », visible sur la capture beta).
 *
 * Ce test verrouille le fait que les deux sont **conditionnés à `!isKrala`** — un
 * retour en arrière (bouton réintroduit sans garde) casserait ici.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const MODAL = "src/components/calendar/event-detail-modal.tsx";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CODE = codeOnly(readFileSync(MODAL, "utf8"));

describe("Modale d'event — actions Metamob désactivées pour les Kralamoure", () => {
    it("le bouton « Terminer l'event » est conditionné à `!isKrala`", () => {
        // Le bloc de clôture ne doit **jamais** rendre pour un event Kralamoure.
        expect(CODE).not.toMatch(/effectiveStatus === "PUBLISHED" && onComplete && \(/);
        expect(CODE).toMatch(/effectiveStatus === "PUBLISHED" && onComplete && !isKrala && \(/);
        expect(CODE).toContain("Terminer l'event");
    });

    it("aucune expulsion de participant sans la garde `!isKrala`", () => {
        const kicks = [...CODE.matchAll(/onKick=\{([^}]*?)\?\s*\(\)\s*=>/gs)].map((match) => match[1]);
        expect(kicks.length, "les deux listes (inscrits + file d'attente) portent un `onKick`").toBeGreaterThanOrEqual(2);
        for (const condition of kicks) {
            expect(condition, `onKick sans garde MetaMob : ${condition.slice(0, 80)}`).toMatch(/!isKrala/);
        }
    });
});
