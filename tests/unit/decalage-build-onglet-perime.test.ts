/**
 * Décalage de build (« onglet périmé ») — verrou du 17/10/2026.
 *
 * 🐛 Mesure (capture utilisateur du 17/10/2026) : sur `POST /dashboard/<guildId>/donjons-et-quetes`
 * → **409** + `UnrecognizedActionError: Server Action "…" was not found on the server`
 * (trois ids différents, un par Server Action appelée depuis la page), puis la page entière
 * remplacée par la frontière d'erreur du module (« Section Indisponible · SIGILOS • MODULE FAILURE »).
 * Cause : le bundle de l'onglet est plus ancien que le serveur — les ids de Server Actions
 * changent à chaque build. « Réessayer » rejouait le **même** bundle ⇒ blocage jusqu'au
 * rechargement manuel, et le commentaire de `sentry-ignores.ts` (« Next recharge tout seul »)
 * était **faux** (vérifié dans `next@16.4.0`).
 *
 * 🔒 Ce que ce fichier verrouille :
 *  ① la règle pure reconnaît l'erreur de Next — et rien d'autre ;
 *  ② la garde anti-boucle : un rechargement automatique au plus par fenêtre ;
 *  ③ les trois frontières d'erreur passent par le panneau de reprise (plus de « Section
 *     Indisponible » trompeuse, plus de remontée Sentry de ce faux positif) ;
 *  ④ la forme de l'erreur reste **celle de Next 16** (dérive lue à la source) ;
 *  ⑤ la modale de création DJ ne masque plus l'étape « ping d'un rôle » en silence.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
    STALE_DEPLOYMENT_RELOAD_KEY,
    STALE_DEPLOYMENT_RELOAD_WINDOW_MS,
    isStaleDeploymentError,
    readStaleDeploymentReloadAt,
    recoverFromStaleDeployment,
    reloadForStaleDeployment,
    shouldAutoReloadForStaleDeployment,
} from "@/lib/stale-deployment";

/** Source de Next : là où l'erreur naît (client) et là où elle prend son nom. */
const NEXT_REDUCER = "node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js";
const NEXT_ERROR = "node_modules/next/dist/client/components/unrecognized-action-error.js";

/** Retire les commentaires : les explications citent le code à dessein. */
function codeSeul(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Id d'action **factice** (jamais un id de build réel) : seule la forme du message compte. */
function erreurDeNext(actionId = "0f1e2d3c4b5a69788796a5b4c3d2e1f0"): Error {
    const error = new Error(
        `Server Action "${actionId}" was not found on the server. \n` +
        "Read more: https://nextjs.org/docs/messages/failed-to-find-server-action"
    );
    error.name = "UnrecognizedActionError";
    return error;
}

describe("décalage de build — règle pure", () => {
    it("① reconnaît l'erreur de Next par son nom, et par son message en repli", () => {
        expect(isStaleDeploymentError(erreurDeNext())).toBe(true);

        // Repli : certaines enveloppes perdent le nom mais gardent le message.
        const sansNom = new Error(`Server Action "abc" was not found on the server.`);
        expect(isStaleDeploymentError(sansNom)).toBe(true);

        // Rien d'autre ne déclenche un rechargement (fail-closed : pas de faux positif).
        expect(isStaleDeploymentError(new Error("Failed to fetch"))).toBe(false);
        expect(isStaleDeploymentError(new Error("Unauthorized"))).toBe(false);
        expect(isStaleDeploymentError("was not found on the server")).toBe(false);
        expect(isStaleDeploymentError(null)).toBe(false);
        expect(isStaleDeploymentError(undefined)).toBe(false);
        expect(isStaleDeploymentError(42)).toBe(false);
        expect(isStaleDeploymentError({})).toBe(false);
    });

    it("④ la forme attendue est bien celle de Next 16 (dérive lue à la source)", () => {
        const reducer = readFileSync(NEXT_REDUCER, "utf8");
        // Next lève ce message exact quand l'en-tête `x-nextjs-action-not-found: 1` est présent.
        expect(reducer).toMatch(/UnrecognizedActionError\(`Server Action/);
        expect(reducer).toContain("was not found on the server");

        const error = readFileSync(NEXT_ERROR, "utf8");
        // Et c'est bien le `name` qui discrimine l'erreur (pas l'`instanceof`, inutilisable
        // hors du bundle client de Next).
        expect(error).toMatch(/this\.name = 'UnrecognizedActionError'/);
    });

    it("② un rechargement automatique au plus par fenêtre de garde", () => {
        const now = 1_000_000;

        expect(shouldAutoReloadForStaleDeployment(now, null)).toBe(true);
        expect(shouldAutoReloadForStaleDeployment(now, Number.NaN)).toBe(true);
        expect(shouldAutoReloadForStaleDeployment(now, now - 1)).toBe(false);
        expect(shouldAutoReloadForStaleDeployment(now, now - STALE_DEPLOYMENT_RELOAD_WINDOW_MS)).toBe(true);
    });
});

describe("décalage de build — reprise côté navigateur", () => {
    const reload = vi.fn();
    const store = new Map<string, string>();

    function stubNavigateur() {
        vi.stubGlobal("window", {
            location: { reload },
            sessionStorage: {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => { store.set(key, value); },
            },
        });
    }

    afterEach(() => {
        reload.mockClear();
        store.clear();
        vi.unstubAllGlobals();
    });

    it("recharge une première fois, puis laisse la main (jamais de boucle)", () => {
        stubNavigateur();

        expect(readStaleDeploymentReloadAt()).toBeNull();
        expect(reloadForStaleDeployment()).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(store.get(STALE_DEPLOYMENT_RELOAD_KEY)).toBeTruthy();

        // Deuxième passage (même onglet, même session) : refusé, bouton manuel ensuite.
        expect(reloadForStaleDeployment()).toBe(false);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("hors navigateur (rendu serveur, tests) la reprise est inerte", () => {
        expect(reloadForStaleDeployment()).toBe(false);
        expect(readStaleDeploymentReloadAt()).toBeNull();
    });

    it("`recoverFromStaleDeployment` ne prend en charge QUE le décalage de build", () => {
        stubNavigateur();

        expect(recoverFromStaleDeployment(new Error("Failed to fetch"))).toBe(false);
        expect(reload).not.toHaveBeenCalled();

        expect(recoverFromStaleDeployment(erreurDeNext())).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);
    });
});

describe("décalage de build — frontières d'erreur", () => {
    const FRONTIERES = [
        "src/app/dashboard/[guildId]/error.tsx",
        "src/app/god/error.tsx",
        "src/app/global-error.tsx",
    ];

    it("③ les trois frontières chargent le panneau de reprise et la règle", () => {
        for (const fichier of FRONTIERES) {
            const source = readFileSync(fichier, "utf8");
            expect(source, fichier).toContain("StaleDeploymentPanel");
            expect(source, fichier).toContain("isStaleDeploymentError");
            // Le panneau remplace l'écran d'échec dès que l'erreur est un décalage de build.
            expect(source, fichier).toMatch(/if \(staleDeployment\)|staleDeployment \?/);
        }
    });

    it("③ bis le faux positif n'est plus remonté à Sentry (recharge, pas « Réessayer »)", () => {
        const dashboard = readFileSync("src/app/dashboard/[guildId]/error.tsx", "utf8");
        expect(dashboard).toMatch(/if \(!staleDeployment\) Sentry\.captureException\(error\)/);

        const globalError = readFileSync("src/app/global-error.tsx", "utf8");
        expect(globalError).toMatch(/if \(!staleDeployment\) Sentry\.captureException\(error\)/);
    });

    it("④ bis `sentry-ignores.ts` corrige sa fausse affirmation (le rechargement était manuel)", () => {
        const source = readFileSync("src/lib/sentry-ignores.ts", "utf8");
        // L'ancienne phrase « Next recharge la page tout seul ⇒ auto-réparée » est datée et
        // démentie : c'est notre reprise qui vit dans `stale-deployment.ts`.
        expect(source).toContain("Correction du 17/10/2026");
        expect(source).toMatch(/était \*\*fausse\*\*/);
        expect(source).not.toMatch(/tout seul ⇒ l'erreur/);
        expect(source).toContain("stale-deployment.ts");
        // …sans perdre la mesure qui motivait le filtre.
        expect(source).toMatch(/65 événements en 24 h/);
    });
});

describe("modale de création DJ — l'étape « ping d'un rôle » ne disparaît plus en silence", () => {
    const source = codeSeul(
        readFileSync("src/components/dungeon-finder/DjPostCreateModal.tsx", "utf8")
    );

    it("⑤ le bloc n'est plus conditionné à la présence de rôles", () => {
        expect(source).toContain("{isDiscordPublished && (");
        expect(source).not.toContain("isDiscordPublished && discordRoles.length > 0 &&");
    });

    it("⑤ bis chaque état se dit : chargement, erreur + « Réessayer », whitelist vide, prêt", () => {
        expect(source).toMatch(/rolesError/);
        expect(source).toMatch(/Chargement des rôles Discord/);
        expect(source).toMatch(/setRolesReloadKey\(\(key\) => key \+ 1\)/);
        expect(source).toMatch(/Aucun rôle autorisé au ping/);
        // Le chemin exact à donner à l'administrateur (étape 3 des réglages du module).
        expect(source).toContain("/admin/settings");
    });

    it("⑤ ter un échec de Server Action n'est plus avalé : le décalage de build est repris", () => {
        expect(source).toMatch(/recoverFromStaleDeployment\(err\)/);
        expect(source).not.toMatch(/\.catch\(console\.error\)/);
        expect(source).toContain('from "@/lib/stale-deployment"');
    });
});

