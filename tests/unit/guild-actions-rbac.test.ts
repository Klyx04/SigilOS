/**
 * RBAC des actions serveur — verrou de l'**audit du 06/11/2026** (chantier rang 57).
 *
 * Contexte mesuré : 143 fichiers d'actions, dont **10** portaient un `guildId` en ne
 * vérifiant qu'une **session** (`auth()`). Tant que `signIn` refusait tout compte sans
 * guilde, le trou restait théorique ; ouvrir la plateforme aux **visiteurs** l'aurait rendu
 * atteignable par n'importe quel compte Discord, sur n'importe quelle guilde.
 *
 * Le même audit a trouvé **6 modules `"use server"` sans aucune authentification**. Ils ont
 * été **sortis du dossier d'actions** le 06/11/2026 (ils n'étaient appelés que par des crons
 * ou par des actions déjà gardées) : ce ne sont plus des actions, donc plus une surface
 * appelable. Le test le vérifie aussi.
 *
 * L'invariant : une action qui reçoit un `guildId` doit porter **un** des mécanismes
 * ci-dessous, ou figurer dans la liste des exceptions **documentées**.
 *
 * Mécanismes acceptés :
 *  · `assertGuildMemberAccess` (garde partagée, `src/server/guild-access.ts`) ;
 *  · `getUserContext` / `getUserContextFrom` (RBAC complet du dépôt) ;
 *  · `guard.allowed` (garde explicite locale, ex. actions internes Discord) ;
 *  · `isGod` / `isSuperAdmin` (surface God, pas d'appartenance à vérifier).
 *
 * ⚠️ Le verrou lit le **source brut**, commentaires retirés : la prose de la cause racine
 * cite les noms de gardes et ferait échouer l'assertion négative autrement.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const ACTIONS_DIR = "src/server/actions";

/**
 * Exceptions **mesurées**, pas des oublis :
 *  · `ocre-guide-actions.ts` lit un profil par `(userId, guildId, status ACTIVE)` — un
 *    non-membre obtient `null`, donc un ensemble vide. Aucune donnée d'autrui.
 *  · `dofus-search-actions.ts`, `dofus-variants-actions.ts`, `dofusbook-actions.ts` ne
 *    portent aucun `guildId` (données de jeu publiques) — hors périmètre, listés pour
 *    mémoire si un `guildId` y apparaît un jour.
 */
const EXCEPTIONS = new Map<string, string>([
    ["ocre-guide-actions.ts", "lecture filtrée par (userId, guildId, ACTIVE) : null pour un non-membre"],
    ["dofus-search-actions.ts", "aucun guildId — données de jeu publiques"],
    ["dofus-variants-actions.ts", "aucun guildId — données de jeu publiques"],
    ["dofusbook-actions.ts", "aucun guildId — données de jeu publiques"],
]);

const GUARD = /assertGuildMemberAccess|getUserContext|getUserContextFrom|guard\.allowed|isGod|isSuperAdmin|requireGuild|assertGuild|canManage/;

/**
 * Dette soldée le 06/11/2026 : les six modules `"use server"` sans authentification ont été
 * déplacés hors de `actions/` (voir le dernier `describe`). La liste est **vide** et doit le
 * rester : un nouveau fichier d'action sans mécanisme d'authentification fait échouer le
 * test, au lieu de grossir une dette silencieuse.
 */
const NO_SESSION_EXPOSURE = new Map<string, string>([]);

const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Tout mécanisme qui établit **qui** appelle (session seule comprise). */
const AUTHENTICATED =
    /auth\(\)|assertGuildMemberAccess|getUserContext|getUserContextFrom|guard\.allowed|isGod|isSuperAdmin|requireGuild|assertGuild|canManage|getServerSession|currentUser/;

describe("Actions serveur — un `guildId` ne suffit pas, il faut une appartenance", () => {
    const files = readdirSync(ACTIONS_DIR).filter((name) => name.endsWith(".ts"));
    const codeOf = (name: string) => stripComments(readFileSync(`${ACTIONS_DIR}/${name}`, "utf8"));

    it("aucune action cloisonnée par guilde ne se contente d'une session", () => {
        const offenders = files.filter((name) => {
            if (EXCEPTIONS.has(name) || NO_SESSION_EXPOSURE.has(name)) return false;
            const code = codeOf(name);
            if (!/^\s*["']use server["']/m.test(code)) return false; // pas une action
            if (!/guildId/.test(code)) return false;                  // hors périmètre
            return !GUARD.test(code);
        });
        expect(offenders).toEqual([]);
    });

    it("la dette « aucun mécanisme d'authentification » est soldée", () => {
        const unauthenticated = files.filter((name) => {
            const code = codeOf(name);
            if (!/^\s*["']use server["']/m.test(code)) return false;
            if (!/guildId/.test(code)) return false;
            return !AUTHENTICATED.test(code);
        });
        expect(unauthenticated.sort()).toEqual([...NO_SESSION_EXPOSURE.keys()].sort());
    });

    it("le ladder porte la garde sur ses DIX lectures", () => {
        const code = stripComments(readFileSync(`${ACTIONS_DIR}/ladder-actions.ts`, "utf8"));
        expect((code.match(/assertGuildMemberAccess\(guildId\)/g) ?? []).length).toBe(10);
    });

    it("l'activité, la présence et les réglages système la portent aussi", () => {
        for (const name of [
            "activity-actions.ts",
            "presence-actions.ts",
            "system-settings-actions.ts",
        ]) {
            const code = stripComments(readFileSync(`${ACTIONS_DIR}/${name}`, "utf8"));
            expect(code, name).toMatch(/assertGuildMemberAccess\(/);
        }
    });

    it("les sessions God ne s'ouvrent qu'à un compte God", () => {
        const code = stripComments(readFileSync(`${ACTIONS_DIR}/god-session-actions.ts`, "utf8"));
        expect((code.match(/isGod !== true/g) ?? []).length).toBe(3);
    });
});

describe("Noyaux sortis du dossier d'actions — plus une surface appelable", () => {
    const CORES = [
        "src/server/badge-triggers.ts",
        "src/server/avatar-sync.ts",
        "src/server/discord-channel-watch.ts",
        "src/server/inactive-posts.ts",
        "src/server/service-activity-log.ts",
    ];

    it("ils existent hors de `src/server/actions` et ne portent pas `use server`", () => {
        for (const file of CORES) {
            expect(existsSync(file), file).toBe(true);
            expect(readFileSync(file, "utf8"), file).not.toMatch(/^\s*["']use server["']/m);
        }
    });

    it("les anciens chemins d'actions ont disparu (aucun pointeur mort)", () => {
        for (const gone of [
            "src/server/actions/badge-triggers.ts",
            "src/server/actions/avatar-sync.ts",
            "src/server/actions/discord-channel-watch-actions.ts",
            "src/server/actions/inactive-posts-actions.ts",
        ]) {
            expect(existsSync(gone), gone).toBe(false);
        }
    });

    it("le journal d'activité garde son action de lecture, protégée, et plus le code mort", () => {
        const code = stripComments(readFileSync(`${ACTIONS_DIR}/activity-log-actions.ts`, "utf8"));
        expect(code).toMatch(/assertGuildMemberAccess\(guildId\)/);
        expect(code).not.toMatch(/getModuleLogs/);
    });
});
