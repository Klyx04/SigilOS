import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    GAME_DATA_ERROR_CAUSES,
    GAME_DATA_ERROR_GROUPS_MAX,
    GAME_DATA_ERROR_REPORTED_MAX,
    GAME_DATA_ERROR_SAMPLE_CHARS,
    GAME_DATA_ERROR_SUMMARY_CAUSES,
    capGameDataErrorGroups,
    classifyGameDataError,
    formatGameDataErrorLines,
    groupGameDataErrors,
    normalizeGameDataErrorGroups,
    sanitizeGameDataErrorMessages,
    summarizeGameDataErrors,
    truncateGameDataError,
} from "@/lib/game-data-error-causes";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

/**
 * Erreurs des siphons game-data — **compteurs réels**, regroupés par cause (chantier A3, 28/09/2026).
 *
 * Dette mesurée : le Tableau publiait `errors.slice(0, 3).join(" · ")`. Sur une passe BOUNTIES à
 * **96 erreurs** (mesure : 92 avis sans butin + 4 fiches en échec), l'utilisateur voyait **trois
 * lignes brutes** et aucun chiffre par cause ⇒ impossible de distinguer « DofusDB ne référence pas
 * ce butin » (rien à corriger) de « DofusDB est tombé » (à relancer) — deux actions opposées.
 */
describe("erreurs game-data — entrée bornée (payload client/worker jamais cru)", () => {
    it("aplatit et tronque un message, en gardant la trace de la coupe", () => {
        expect(truncateGameDataError("  Avis  12 :\n   échec  ")).toBe("Avis 12 : échec");
        const long = truncateGameDataError("z".repeat(GAME_DATA_ERROR_SAMPLE_CHARS + 40));
        expect(long).toHaveLength(GAME_DATA_ERROR_SAMPLE_CHARS + 1); // + l'ellipse
        expect(long.endsWith("…")).toBe(true);
    });

    it("`sanitize` ignore types inconnus et vides, tronque chaque message, plafonne la liste", () => {
        expect(sanitizeGameDataErrorMessages(null)).toEqual([]);
        expect(sanitizeGameDataErrorMessages("Avis 1 : échec")).toEqual([]);
        expect(
            sanitizeGameDataErrorMessages([42, null, { message: "x" }, "", "   ", "Avis 1 : échec"]),
        ).toEqual(["Avis 1 : échec"]);
        // Un message de 5 000 caractères n'entre pas tel quel dans l'état publié.
        expect(sanitizeGameDataErrorMessages(["z".repeat(5000)])[0]).toHaveLength(
            GAME_DATA_ERROR_SAMPLE_CHARS + 1,
        );
        const flood = Array.from({ length: GAME_DATA_ERROR_REPORTED_MAX + 25 }, (_, i) => `Avis ${i} : 500`);
        expect(sanitizeGameDataErrorMessages(flood)).toHaveLength(GAME_DATA_ERROR_REPORTED_MAX);
        expect(sanitizeGameDataErrorMessages(flood, { max: 3 })).toHaveLength(3);
    });

    it("`cap` garde la cause dominante d'abord et **copie** (aucun alias sur la source)", () => {
        const groups = Array.from({ length: GAME_DATA_ERROR_GROUPS_MAX + 5 }, (_, i) => ({
            key: `k${i}`,
            label: `cause ${i}`,
            count: i + 1,
            sample: `exemple ${i}`,
        }));
        const capped = capGameDataErrorGroups(groups);
        expect(capped).toHaveLength(GAME_DATA_ERROR_GROUPS_MAX);
        expect(capped[0]).toEqual(groups[0]);
        capped[0].count = 999;
        expect(groups[0].count).toBe(1); // l'état publié ne peut pas être muté depuis l'affichage
        expect(capGameDataErrorGroups(groups, 0)).toHaveLength(1); // plancher : jamais une liste vide à tort
    });
});

describe("erreurs game-data — chaque cause a un libellé stable, testé et ordonné", () => {
    /** Un échantillon **réel** par cause : ajouter une cause au registre sans échantillon = test rouge. */
    const SAMPLE_BY_CAUSE: Record<string, string> = {
        "race-indisponible": "DofusDB monsters?race=12 indisponible (HTTP 503)",
        "race-plafond": "Avis 3 : la race sature le plafond de 50 avis (suite partielle)",
        "dofensive-indisponible": "Avis 3 : Dofensive indisponible — avis non prouvé",
        "fiche-homonyme": "Avis 3 : fiche résolue vers l'id 42 (homonyme) — ignorée",
        "grades-absents": "Avis 3 : grades introuvables (fiche sans stats)",
        "butin-absent": "Avis 3 : aucun butin référencé par DofusDB",
        "butin-illisible": "Avis 3 : butin illisible (onglet masqué)",
        "butin-non-relu": "Avis 3 : butin non relu (repli en échec)",
        "avis-echec": "Avis 3 : 500 — Internal Server Error",
    };

    it("classe chaque cause connue, sans qu'un motif en masque un autre", () => {
        expect(new Set(GAME_DATA_ERROR_CAUSES.map((cause) => cause.key)).size).toBe(
            GAME_DATA_ERROR_CAUSES.length,
        );
        for (const cause of GAME_DATA_ERROR_CAUSES) {
            const sample = SAMPLE_BY_CAUSE[cause.key];
            expect(sample, `cause « ${cause.key} » : ajouter un échantillon réel dans ce test`).toBeTruthy();
            expect(classifyGameDataError(sample), `${cause.key} mal classé`).toEqual({
                key: cause.key,
                label: cause.label,
            });
        }
        // Le fourre-tout (« ^Avis ») doit rester **en dernier** : sinon il avale toutes les causes fines,
        // qui arrivent préfixées de la même façon (« Avis 12 : butin illisible »).
        expect(GAME_DATA_ERROR_CAUSES.at(-1)?.key).toBe("avis-echec");
        expect(classifyGameDataError("Avis 12 : butin illisible (onglet masqué)").key).toBe("butin-illisible");
    });

    it("une cause inconnue n'est jamais muette : son message EST la cause", () => {
        const unknown = classifyGameDataError("boom inattendu");
        expect(unknown.label).toBe("boom inattendu");
        expect(unknown.key.startsWith("autre")).toBe(true);
        expect(classifyGameDataError("   ").label).toBe("(message vide)");
        // Deux messages différents = deux causes distinctes (un seul « autre » les aurait fondus
        // sous le premier message rencontré : le compteur aurait décrit un lot qu'il ne nommait pas).
        const groups = groupGameDataErrors(["boom A", "boom A", "boom A", "boom B", "Avis 1 : 500"]);
        expect(groups.map((group) => group.key)).toEqual([
            classifyGameDataError("boom A").key,
            classifyGameDataError("boom B").key,
            "avis-echec",
        ]);
        expect(groups.map((group) => group.count)).toEqual([3, 1, 1]);
        expect(groups.map((group) => group.label)).toEqual(["boom A", "boom B", "fiche en échec (erreur remontée par l'API)"]);
    });

    it("trie par fréquence puis par libellé : deux passes identiques se comparent", () => {
        const messages = [
            ...Array.from({ length: 4 }, () => "Avis 1 : 500 — Internal Server Error"),
            ...Array.from({ length: 7 }, () => "Avis 2 : aucun butin référencé par DofusDB"),
            "Avis 3 : 500 — Internal Server Error",
        ];
        const groups = groupGameDataErrors(messages);
        expect(groups.map((group) => group.key)).toEqual(["butin-absent", "avis-echec"]);
        expect(groups.map((group) => group.count)).toEqual([7, 5]);
        expect(groups[0].sample).toContain("aucun butin référencé"); // premier message rencontré
        // Le même lot dans un autre ordre donne le même résumé : c'est CE qui rend deux passes comparables.
        const reordered = groupGameDataErrors([...messages].reverse());
        expect(reordered.map((group) => `${group.key}:${group.count}`)).toEqual(
            groups.map((group) => `${group.key}:${group.count}`),
        );
        expect(summarizeGameDataErrors([...messages].reverse())).toBe(summarizeGameDataErrors(messages));
    });
});


describe("erreurs game-data — une ligne chiffrée, jamais un mur de messages", () => {
    it("résume le total, cite les causes dominantes et **compte** le reste", () => {
        const messages = [
            ...Array.from({ length: 92 }, () => "Avis 1 : aucun butin référencé par DofusDB"),
            ...Array.from({ length: 4 }, () => "Avis 2 : 500 — Internal Server Error"),
            ...Array.from({ length: 3 }, () => "DofusDB monsters?race=7 indisponible (HTTP 503)"),
            "Avis 9 : grades introuvables (fiche sans stats)",
        ];
        expect(messages).toHaveLength(100);
        expect(summarizeGameDataErrors(messages)).toBe(
            "100 erreur(s) : aucun butin référencé par DofusDB (92×) · " +
                "fiche en échec (erreur remontée par l'API) (4×) · " +
                "race DofusDB indisponible (3×) · +1 autre(s) cause(s)",
        );
        // Aucune erreur ⇒ aucune ligne : l'appelant n'écrit rien, jamais un « 0 erreur » trompeur.
        expect(summarizeGameDataErrors([])).toBeUndefined();
    });

    it("borne le nombre de causes citées : le reste est annoncé, jamais coupé en silence", () => {
        const messages = [
            "Avis 1 : aucun butin référencé",
            "Avis 2 : butin illisible",
            "Avis 3 : butin non relu",
            "Avis 4 : grades introuvables",
            "Avis 5 : Dofensive indisponible",
            "Avis 6 : fiche résolue vers l'id 7 (homonyme)",
        ];
        const summary = summarizeGameDataErrors(messages) ?? "";
        expect(summary.startsWith("6 erreur(s) : ")).toBe(true);
        expect(summary.match(/\(1×\)/g)?.length).toBe(GAME_DATA_ERROR_SUMMARY_CAUSES);
        expect(summary).toContain(`+${messages.length - GAME_DATA_ERROR_SUMMARY_CAUSES} autre(s) cause(s)`);
    });

    it("le journal live détaille une ligne par cause, avec son exemple", () => {
        const lines = formatGameDataErrorLines([
            "Avis 1 : 500 — Internal Server Error",
            "Avis 2 : 500 — Internal Server Error",
            "Avis 3 : aucun butin référencé par DofusDB",
        ]);
        expect(lines[0]).toBe("❌ 3 erreur(s) — regroupées par cause :");
        expect(lines[1]).toContain("fiche en échec (erreur remontée par l'API) : 2×");
        expect(lines[1]).toContain("Avis 1 : 500"); // l'exemple, jamais tout le lot
        expect(lines[2]).toContain("aucun butin référencé par DofusDB : 1×");
        expect(formatGameDataErrorLines([])).toEqual([]);
        // Plafond : au-delà, on annonce ce qui reste au lieu de peindre un mur de lignes.
        const bounded = formatGameDataErrorLines(
            ["souci A", "souci B", "souci C", "souci D", "souci E", "souci F"],
            { max: 2 },
        );
        expect(bounded).toHaveLength(1 + 2 + 1);
        expect(bounded.at(-1)).toContain("… 4 autre(s) cause(s)");
    });
});


describe("erreurs game-data — relecture d'un payload sérialisé", () => {
    it("n'accepte que des causes exploitables (une entrée douteuse est ignorée, jamais devinée)", () => {
        expect(normalizeGameDataErrorGroups(null)).toBeNull();
        expect(normalizeGameDataErrorGroups({})).toBeNull();
        expect(normalizeGameDataErrorGroups([])).toBeNull();
        // Que des entrées invalides ⇒ `null` : l'écran montre `lastError`, jamais un compteur faux.
        expect(
            normalizeGameDataErrorGroups([
                { key: "butin-absent", label: "aucun butin référencé", count: -3, sample: "x" },
                { label: "sans clé", count: 2, sample: "x" },
                { key: "sans-libelle", count: 2, sample: "x" },
                { key: "compte-nan", label: "compte NaN", count: "beaucoup", sample: "x" },
            ]),
        ).toBeNull();
        expect(
            normalizeGameDataErrorGroups([
                { key: "butin-absent", label: "aucun butin référencé", count: 92.7, sample: "z".repeat(400) },
                { key: "corrompu" }, // ignorée isolément : elle ne fait pas tomber la liste entière
            ]),
        ).toEqual([
            {
                key: "butin-absent",
                label: "aucun butin référencé",
                count: 92,
                sample: "z".repeat(GAME_DATA_ERROR_SAMPLE_CHARS) + "…",
            },
        ]);
        // Le payload ne peut pas faire dépasser le plafond de l'écran.
        const flood = Array.from({ length: GAME_DATA_ERROR_GROUPS_MAX + 20 }, (_, i) => ({
            key: `k${i}`,
            label: `cause ${i}`,
            count: 1,
            sample: "x",
        }));
        expect(normalizeGameDataErrorGroups(flood)).toHaveLength(GAME_DATA_ERROR_GROUPS_MAX);
    });
});

describe("erreurs game-data — le lot COMPLET alimente l'état (les 3 premières lignes ne le font plus)", () => {
    it("le store chiffre `lastError` et publie `errorGroups`, et efface les causes sur succès", () => {
        const store = read("src/server/game-data-sync-state-store.ts");
        expect(store).toContain("capGameDataErrorGroups(groupGameDataErrors(failures))");
        expect(store).toContain("errorGroups: opts.ok ? null : groups");
        // Passe périmée : les causes de la passe précédente ne décrivent pas cet échec-là.
        expect(store).toContain("errorGroups: null,");
        expect(store).toContain("summarizeGameDataErrors(failures)");
    });

    it("chaque étage transmet le lot borné : action serveur, lanceur d'onglet, worker", () => {
        const actions = read("src/server/actions/game-data-sync-actions.ts");
        expect(actions).toContain('import { sanitizeGameDataErrorMessages } from "@/lib/game-data-error-causes"');
        expect(actions).toContain("errors: sanitizeGameDataErrorMessages(errors)");
        const runners = read("src/components/admin/game-data-inline-runners.ts");
        expect(runners).toContain(
            "finishGameDataSync(dataset, result.ok, result.summary || undefined, result.error, result.errors)",
        );
        const worker = read("src/workers/game-data-worker.ts");
        expect(worker).toContain('reportErrorBatch("BOUNTIES", batch)');
        expect(worker).toContain("formatGameDataErrorLines(errors)");
        // Le panneau peint les compteurs, plafonnés à ce qui reste lisible.
        const panel = read("src/components/admin/GameDataSyncStatePanel.tsx");
        expect(panel).toContain("state.errorGroups");
        expect(panel).toContain("groups.slice(0, ERROR_GROUPS_SHOWN)");
    });

    it("aucun écran ne re-résume à sa façon (une seule source : le module pur)", () => {
        for (const file of [
            "src/components/admin/GameDataSyncStatePanel.tsx",
            "src/components/admin/game-data-inline-runners.ts",
            "src/server/game-data-sync-state-store.ts",
            "src/workers/game-data-worker.ts",
        ]) {
            // Seules les lignes de **code** comptent : la doc cite volontairement l'ancienne dette
            // (`errors.slice(0, 3).join(" · ")`) — un rappel de dette n'est pas un correctif manqué.
            const code = read(file)
                .split("\n")
                .filter((line) => {
                    const trimmed = line.trim();
                    return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
                })
                .join("\n");
            expect(code, `${file} ne doit plus couper le lot aux 3 premiers messages`).not.toContain(
                ".slice(0, 3)",
            );
        }
    });
});

