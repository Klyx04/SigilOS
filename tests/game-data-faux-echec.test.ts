/**
 * A5 — **« le Tableau ne peint plus en rouge ce qui n'est pas un échec »** (28/09/2026).
 *
 * 🐛 Mesures (lecture de code + capture user du Tableau God) : quatre lignes se lisaient comme des
 * pannes qui n'en étaient pas — ① « Avis de recherche — 2 race(s) en échec » sans aucun chiffre ni
 * cause (le résumé du lanceur omettait `unchanged`/`unproven`, et `lastError` écrasait le résumé par
 * cause) ; ② la cause « race DofusDB indisponible » n'était **pas** reconnue parce que le lanceur
 * préfixe le message par le nom de la race (« Amakna : DofusDB monsters?race=12 indisponible ») alors
 * que le registre teste le message du cœur (ancré `^`) ; ③ « Référentiel incomplet (2 page(s) en
 * attente sur notre limite locale) » était rouge alors que la cause est **notre** budget (30 req/min),
 * pas DofusDB ; ④ « Grimoires — OK » voisinait « 204 icône(s) en échec » sans dire lequel bloquait.
 * S'y ajoute ⑤ « Veille : 0 créé(s) · 0 modifié(s) · 0 inchangé(s) », lu comme un échec alors que
 * DofusDB n'avait simplement rien renvoyé depuis le filigrane.
 *
 * 🔒 Ce que ce test verrouille : les règles **pures** (classification avec préfixe de contexte,
 * concaténation de `lastError`) **et** les points d'écriture (résumé des avis, `ok` du référentiel,
 * compteurs des grimoires, messages de la veille items) — un `ok: false` doit toujours dire POURQUOI.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    classifyGameDataError,
    combineGameDataRunError,
    groupGameDataErrors,
    stripGameDataErrorContext,
    summarizeGameDataErrors,
} from "@/lib/game-data-error-causes";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

const RUNNERS = "src/components/admin/game-data-inline-runners.ts";
const CAUSES = "src/lib/game-data-error-causes.ts";
const STORE = "src/server/game-data-sync-state-store.ts";
const WORKER = "src/workers/game-data-worker.ts";
const SIPHON_REF = "src/lib/market/referential-siphon.ts";

describe("A5 — le message préfixé par un lanceur est classé sur le message du cœur", () => {
    it("« <Race> : DofusDB monsters?race=N indisponible » ⇒ « race DofusDB indisponible »", () => {
        expect(classifyGameDataError("Amakna : DofusDB monsters?race=12 indisponible")).toEqual({
            key: "race-indisponible",
            label: "race DofusDB indisponible",
        });
        expect(classifyGameDataError("Avis de recherche de Frigost : DofusDB monsters?race=90 indisponible").key).toBe(
            "race-indisponible",
        );
        expect(
            classifyGameDataError("Amakna : DofusDB monsters?race=12 sature le plafond de 50 (avis potentiellement tronqués)")
                .key,
        ).toBe("race-plafond");
    });

    it("le message complet reste prioritaire (aucune cause existante ne change de camp)", () => {
        expect(classifyGameDataError("Avis Ronce : aucun butin référencé par DofusDB").key).toBe("butin-absent");
        expect(classifyGameDataError("Avis Predagob : grades introuvables (ni détail ni liste) — fiche sans stats").key).toBe(
            "grades-absents",
        );
    });

    it("le préfixe de contexte est borné : un vrai message n'est jamais rogné", () => {
        expect(stripGameDataErrorContext("Amakna : DofusDB items indisponible")).toBe("DofusDB items indisponible");
        expect(stripGameDataErrorContext("DofusDB items indisponible")).toBeNull();
        expect(stripGameDataErrorContext("")).toBeNull();
        // Au-delà de 60 caractères, ce n'est plus une étiquette : on ne touche pas au message.
        expect(stripGameDataErrorContext(`${"x".repeat(70)} : DofusDB items indisponible`)).toBeNull();
    });

    it("deux races différentes se regroupent sous UNE cause, avec le contexte conservé en exemple", () => {
        const groups = groupGameDataErrors([
            "Amakna : DofusDB monsters?race=12 indisponible",
            "Avis de recherche de Frigost : DofusDB monsters?race=90 indisponible",
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].label).toBe("race DofusDB indisponible");
        expect(groups[0].count).toBe(2);
        expect(groups[0].sample).toContain("Amakna");
        expect(
            summarizeGameDataErrors([
                "Amakna : DofusDB monsters?race=12 indisponible",
                "Avis de recherche de Frigost : DofusDB monsters?race=90 indisponible",
            ]),
        ).toBe("2 erreur(s) : race DofusDB indisponible (2×)");
    });
});

describe("A5 — `lastError` garde le chiffre ET la phrase", () => {
    it("concatène la phrase de l'appelant et le résumé par cause (jamais l'un à la place de l'autre)", () => {
        expect(
            combineGameDataRunError("2 race(s) en échec", "2 erreur(s) : race DofusDB indisponible (2×)"),
        ).toBe("2 race(s) en échec — 2 erreur(s) : race DofusDB indisponible (2×)");
        expect(combineGameDataRunError(undefined, "2 erreur(s) : race DofusDB indisponible (2×)")).toBe(
            "2 erreur(s) : race DofusDB indisponible (2×)",
        );
        expect(combineGameDataRunError("Catalogue : timeout", null)).toBe("Catalogue : timeout");
        expect(combineGameDataRunError(null, undefined)).toBeNull();
        expect(combineGameDataRunError("   ", " ")).toBeNull();
    });

    it("le store passe par la règle pure (aucune substitution inline)", () => {
        const store = read(STORE);
        expect(store).toContain("combineGameDataRunError(opts.error");
        expect(store).not.toContain("opts.error ?? summarizeGameDataErrors");
    });
});


describe("A5 — les points d'écriture ne peignent plus en rouge ce qui n'est pas un échec", () => {
    it("le résumé des avis publie les 4 chiffres (écrits, inchangés, non prouvés, icônes)", () => {
        const runners = read(RUNNERS);
        expect(runners).toContain("${totals.unchanged} inchangés");
        expect(runners).toContain("${totals.unproven} non prouvés");
        expect(runners).toContain("Avis de recherche : ${totals.total} avis");
    });

    it("le référentiel n'est rouge que si DofusDB n'a pas rendu la page (notre cadence = attente)", () => {
        // Le siphon expose la distinction (elle existait en interne, elle n'était pas publiée).
        expect(read(SIPHON_REF)).toContain("failedPages: number[];");
        const runners = read(RUNNERS);
        expect(runners).toContain("ok: d.failedPages.length === 0");
        expect(runners).not.toContain("ok: !d.truncated,");
        // Même règle côté worker : le message dit laquelle des deux causes, et la passe n'est rouge
        // que pour une page non rendue par DofusDB.
        const worker = read(WORKER);
        expect(worker).toContain("ok: result.failedPages.length === 0");
        expect(worker).toContain("page(s) non rendues par DofusDB");
        expect(worker).toContain("page(s) en attente sur notre limite locale");
    });

    it("une icône en échec ne rend pas la passe rouge — et le résumé le dit", () => {
        const runners = read(RUNNERS);
        expect(runners).toContain("ok: failedRuns === 0");
        expect(runners).toContain("iconsFailed: 0");
        expect(runners).toContain("non bloquant — re-tenté au prochain passage");
        // Les icônes ne sont plus fondues dans une colonne « erreur(s) » indistincte.
        expect(runners).not.toContain("totals.errors += res.data.iconsFailed");
    });

    it("la veille items sans aucune modification dit « rien à faire », pas « 0 · 0 · 0 »", () => {
        const worker = read(WORKER);
        expect(worker).toContain("aucun item modifié chez DofusDB depuis le filigrane (rien à faire)");
        expect(worker).toContain("aucun item renvoyé par DofusDB (rien à faire)");
    });

    it("la classification tolère un préfixe de contexte côté lib (et pas seulement dans le lanceur)", () => {
        expect(read(CAUSES)).toContain("export function stripGameDataErrorContext");
        expect(read(CAUSES)).toContain("GAME_DATA_ERROR_CONTEXT_PREFIX");
    });
});
