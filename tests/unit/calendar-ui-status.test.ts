/**
 * Statut affiché dans le calendrier — **le serveur décide, l'écran affiche**.
 *
 * Constat du 25/10/2026 (capture beta) : les trois composants du calendrier
 * rejugeaient la date (`endDate < Date.now()`) au lieu de lire `event.status`.
 * Conséquence : un raid terminé depuis une minute s'affichait « Terminé », et le
 * bouton « Clôturer le Raid » disparaissait alors que la base le laissait `PUBLISHED`
 * (impasse : ni clôture, ni annulation possibles). La règle unique vit dans
 * `@/lib/calendar-auto-close`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const GRID = codeOnly(readFileSync("src/components/calendar/calendar-grid.tsx", "utf8"));
const CARD = codeOnly(readFileSync("src/components/calendar/event-card.tsx", "utf8"));
const MODAL = codeOnly(readFileSync("src/components/calendar/event-detail-modal.tsx", "utf8"));

describe("Aucun composant ne rejuge la date de fin", () => {
    it("le filigrane « Terminé » suit uniquement `event.status`", () => {
        for (const [name, code] of [["grille", GRID], ["carte", CARD], ["modale", MODAL]] as const) {
            expect(code, `${name} : plus de « terminé » déduit de la date`).not.toMatch(
                /isCompleted = event\.status === "COMPLETED" \|\|/
            );
        }
    });

    it("le statut effectif de la modale est celui du serveur", () => {
        expect(MODAL).toMatch(/const isCompleted = event\.status === "COMPLETED";/);
        expect(MODAL).toMatch(/const effectiveStatus = event\.status;/);
        expect(MODAL).not.toMatch(/effectiveStatus = isCompleted \?/);
    });

    it("la grille et la carte n'ont plus aucune comparaison de date", () => {
        expect(GRID).not.toMatch(/event\.endDate\)\.getTime\(\) < Date\.now\(\)/);
        expect(CARD).not.toMatch(/event\.endDate\)\.getTime\(\) < Date\.now\(\)/);
    });
});

describe("Raid terminé mais non clôturé — visible et actionnable", () => {
    it("la modale signale « À clôturer » sans bloquer les actions", () => {
        expect(MODAL).toMatch(/const awaitsClosure =/);
        expect(MODAL).toContain("À clôturer");
    });

    it("un raid clôturé d'office propose de saisir présents + score", () => {
        expect(MODAL).toMatch(
            /const systemClosed = isRaid && effectiveStatus === "COMPLETED" && !raidMeta\?\.completedAt;/
        );
        expect(MODAL).toContain("Compléter le raid");
        expect(MODAL).toContain("Clôturé d'office — à compléter");
    });

    it("le bouton « Clôturer le Raid » reste rendu tant que le serveur dit PUBLISHED", () => {
        expect(MODAL).toMatch(/effectiveStatus === "PUBLISHED" && onComplete && !isKrala && \(/);
    });
});
