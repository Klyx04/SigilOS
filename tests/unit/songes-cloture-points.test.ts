import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Règle métier — **clôture d'une run Songes et distribution des points de contribution**.
 *
 * 🐞 Bug rapporté le 13/10/2026 (guilde `1290442961380835451`) : une run **PARADOXE II (épreuve)**
 * affichait « +2 points » dans l'écran de clôture puis renvoyait
 * « Les runs épreuve ne distribuent pas de points de contribution » — alors que le barème était bien
 * réglé dans `admin/points`.
 *
 * 🔍 Cause racine MESURÉE : la garde `if (run.epreuveCode) return { success: false, … }` a été
 * introduite par un passage sécurité **générique** (`4881fb1b`, 04/04/2026) et **aucun appelant ne la
 * respectait** — son docblock l'imputait au client (« caller must check epreuveCode === null »), qui
 * ne l'a jamais vérifiée. Résultat : une **impasse** produit sur un réglage légitime.
 *
 * 🛡️ Ce que ce test verrouille : ① plus aucun refus lié à `epreuveCode` (les épreuves distribuent le
 * barème de leur difficulté) ; ② les vrais invariants restent en place — **leader seul**, **leader
 * exclu de la distribution**, écriture **bornée à la guilde**, **journal d'audit** (avec le code
 * d'épreuve) ; ③ l'écran de clôture **dit** qu'il s'agit d'une épreuve au lieu de mener à une erreur.
 *
 * Lecture seule.
 */

const ACTIONS = "src/server/actions/songes/dream-run-actions.ts";
const MODAL = "src/components/songes/RunCloseModal.tsx";
const CARD = "src/components/songes/RunCard.tsx";

/** Retire les commentaires : on juge le CODE, pas la prose (le docblock cite l'ancien message). */
const codeOnly = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("clôture de run Songes — les épreuves distribuent leur barème", () => {
    const actions = readFileSync(ACTIONS, "utf8");
    const actionsCode = codeOnly(ACTIONS);

    it("n'a plus d'impasse sur `epreuveCode`", () => {
        expect(actionsCode).not.toContain("ne distribuent pas de points de contribution");
        expect(actionsCode).not.toMatch(/if \(run\.epreuveCode\)\s*\{[\s\S]{0,200}?success: false/);
    });

    it("le contrat est écrit noir sur blanc (épreuve ⇒ même barème)", () => {
        expect(actions).toMatch(/Les runs « épreuve » distribuent AUSSI/);
        expect(actionsCode).toContain("resolveSongesContributionPoints(run.difficulty, guildConfig.pointsConfig");
    });

    it("la distribution reste bornée : leader seul, leader exclu, guilde filtrée", () => {
        // 1. Seul le leader peut clôturer avec distribution.
        expect(actionsCode).toContain("if (run.leaderId !== ctx.userId)");
        // 2. Le leader ne se récompense pas lui-même.
        expect(actionsCode).toMatch(/toReward = validatedProfileIds\.filter\(\s*\(pid\) => pid !== leaderProfileId/);
        // 3. L'écriture est cloisonnée par la guilde (isolation multi-tenant).
        expect(actionsCode).toMatch(/id: \{ in: toReward \},\s*guildId: guildConfig\.id/);
        // 4. Toute distribution est journalisée, avec la difficulté ET l'épreuve éventuelle.
        expect(actionsCode).toContain('action: "SONGES_RUN_CLOSED_WITH_CONTRIBUTIONS"');
        expect(actionsCode).toMatch(/metadata: \{[\s\S]{0,200}epreuveCode: run\.epreuveCode/);
    });

    it("l'écran de clôture annonce l'épreuve au lieu de la cacher", () => {
        const modal = readFileSync(MODAL, "utf8");
        expect(modal).toContain("epreuveLabel?: string | null");
        expect(modal).toMatch(/epreuveLabel && \(/);
        expect(modal).toContain("Run <strong>épreuve");
        // Le chemin serveur reste la distribution avec contribution.
        expect(modal).toContain("closeRunWithContributions(");
    });

    it("la carte de run transmet le libellé de l'épreuve", () => {
        expect(readFileSync(CARD, "utf8")).toContain("epreuveLabel={epreuve?.label ?? null}");
    });
});
