/**
 * Régression (13/09) — **les sélecteurs de rôles du panneau Marché étaient vides**.
 *
 * Bug corrigé : `market-settings-client.tsx` déballait la réponse de
 * `getDiscordRolesAction()` avec `(rolesRes as { data?: Role[] }).data`, alors que
 * l'action renvoie `{ success, roles }` et **jamais** `data` ⇒ `setRoles([])`
 * systématique ⇒ « Rôle à mentionner à la publication », « Rôle modérateur du
 * marché », « Rôle minimum pour publier » et « Rôles que le créateur peut
 * mentionner » n'affichaient **aucun rôle Discord** (constat beta).
 *
 * Le Marché était le **seul** des 7 panneaux de réglages à utiliser ce motif :
 * `discord`, `dj`, `polls`, `mission`, `calendar` et `songes` consomment tous
 * `rolesRes.success && rolesRes.roles`.
 *
 * Ce test lit les sources (l'environnement vitest est `node` : aucun rendu React
 * possible) et verrouille : le contrat de l'action, le motif du panneau Marché,
 * l'absence de `.data` chez **tout** consommateur, et le texte affiché sous le
 * sélecteur de salon (qui promettait à tort la création des tags de forum).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const USER_ACTIONS = "src/server/actions/user-actions.ts";
const MARKET_SETTINGS = "src/app/dashboard/[guildId]/admin/_components/market-settings-client.tsx";

/** Fichiers `.ts`/`.tsx` d'un dossier, séparateurs normalisés (chemins Windows → `/`). */
function sourceFiles(root: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(root, entry.name);
        if (entry.isDirectory()) out.push(...sourceFiles(full));
        else if (/\.tsx?$/.test(entry.name)) out.push(full.replace(/\\/g, "/"));
    }
    return out;
}

/**
 * Retire les commentaires : un garde-fou doit analyser **le code**, pas la prose
 * (les commentaires qui expliquent le bug citent forcément le motif fautif).
 * Le `[^:]` protège les URL (`https://…`) d'être prises pour un commentaire.
 */
function codeOnly(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function read(path: string): string {
    return readFileSync(path, "utf8");
}

function readCode(path: string): string {
    return codeOnly(read(path));
}

describe("getDiscordRolesAction — contrat de retour", () => {
    it("renvoie `{ success, roles }` (jamais `data`)", () => {
        const source = read(USER_ACTIONS);
        const start = source.indexOf("export async function getDiscordRolesAction");
        expect(start, "action introuvable dans user-actions.ts").toBeGreaterThan(-1);

        const body = codeOnly(source.slice(start, source.indexOf("\n}", start)));
        expect(body, "la réponse doit porter la clé `roles`").toMatch(/roles:\s*filteredRoles\.map/);
        expect(body, "`data` n'existe pas dans ce contrat").not.toMatch(/\bdata:/);
    });
});

describe("Panneau Marché — sélecteurs de rôles (régression « aucun rôle »)", () => {
    it("déballe la réponse via `rolesRes.success && rolesRes.roles`", () => {
        expect(readCode(MARKET_SETTINGS)).toMatch(/rolesRes\.success\s*&&\s*rolesRes\.roles/);
    });

    it("ne lit plus jamais `rolesRes.data`", () => {
        const suspicious = [...readCode(MARKET_SETTINGS).matchAll(/rolesRes[^\n;]*\.data\b/g)].map((m) => m[0]);
        expect(suspicious, `accès à une propriété inexistante : ${suspicious.join(" · ")}`).toEqual([]);
    });

    it("les 4 sélecteurs reçoivent bien la liste de rôles", () => {
        const passed = [...read(MARKET_SETTINGS).matchAll(/roles=\{roles\}/g)].length;
        // 3 × RoleSelector (à mentionner, modérateur, minimum) + 1 × PingRolesSelector.
        expect(passed).toBe(4);
    });

    it("convertit la couleur Discord (entier) en `#rrggbb` pour les pastilles", () => {
        // `PingRolesSelector` attend une **couleur CSS** : un entier Discord brut
        // (ex. 16711680) produirait une pastille sans couleur.
        expect(readCode(MARKET_SETTINGS)).toMatch(/toString\(16\)\.padStart\(6,\s*"0"\)/);
    });
});

describe("Aucun consommateur de getDiscordRolesAction ne lit `.data`", () => {
    it("tous les fichiers de `src/` suivent le contrat `{ success, roles }`", () => {
        const consumers = sourceFiles("src").filter(
            (file) => file !== USER_ACTIONS && read(file).includes("getDiscordRolesAction")
        );
        expect(consumers.length, "aucun consommateur détecté — test inopérant").toBeGreaterThan(5);

        const offenders = consumers.filter((file) => /rolesRes[^\n;]*\.data\b/.test(readCode(file)));
        expect(offenders, "réponse déballée via `.data` (liste silencieusement vide)").toEqual([]);
    });
});

describe("Panneau Marché — texte sous le sélecteur de salon", () => {
    it("ne promet plus que SigilOS crée les tags de forum", () => {
        const source = readCode(MARKET_SETTINGS);
        expect(source).not.toMatch(/SigilOS crée les tags/);
        expect(source, "le texte doit renvoyer aux tags déjà existants").toMatch(/déjà existants/);
    });
});
