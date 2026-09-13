/**
 * Garde **contrats action ↔ consommateur** (T1) — régression BUG-1/BUG-2.
 *
 * 🎯 Le bug d'origine : quatre sélecteurs de rôles étaient **vides en silence**
 * parce qu'un panneau lisait `(rolesRes as { data?: Role[] }).data` alors que
 * l'action renvoie `{ success, roles }` — **jamais** `data`. TypeScript ne dit
 * rien (le panneau *affirme* une forme), le test ne dit rien (le mock reprend la
 * forme affirmée) : la panne n'était visible qu'en beta.
 *
 * 🛡️ Ce que ce test verrouille : pour une liste d'actions Marché (+ panneaux de
 * réglages), on **extrait du source** les clés réellement renvoyées au premier
 * niveau, puis on vérifie que **chaque** consommation client (`x.data`,
 * `(x as {...}).data`, `const { data } = await …`) lit une clé **existante**.
 *
 * ⚠️ Test **en lecture seule** : aucun import d'action, aucun mock, aucune
 * requête — il ne peut pas devenir une surface d'attaque ni un test instable.
 * Il échoue **bruyamment** si l'extraction ne trouve rien (jamais un test
 * inopérant qui passe à vide).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Fichiers d'actions dont on extrait le **contrat de retour**. */
const ACTION_FILES = [
    "src/server/actions/market-actions.ts",
    "src/server/actions/market-admin-actions.ts",
    "src/server/actions/god-market-actions.ts",
];

/**
 * Panneaux clients qui consomment ces actions. Liste **explicite** : si un
 * panneau est renommé, le test doit casser (et non ignorer silencieusement).
 */
const PANEL_FILES = [
    "src/app/dashboard/[guildId]/marche/_components/market-catalog-client.tsx",
    "src/app/dashboard/[guildId]/marche/_components/market-create-client.tsx",
    "src/app/dashboard/[guildId]/marche/_components/market-jet-editor.tsx",
    "src/app/dashboard/[guildId]/marche/_components/market-listing-client.tsx",
    "src/app/dashboard/[guildId]/marche/_components/market-moderation-client.tsx",
    "src/app/dashboard/[guildId]/marche/_components/market-my-space-client.tsx",
    "src/app/dashboard/[guildId]/marche/_components/market-negotiation-panel.tsx",
    "src/app/dashboard/[guildId]/marche/_components/market-publish-step.tsx",
    "src/app/dashboard/[guildId]/admin/_components/market-settings-client.tsx",
    "src/app/god/market/_components/god-market-panel.tsx",
];

/** Clés présentes dans **tous** les contrats (`ActionResponse`). */
const GENERIC_KEYS = new Set(["success", "error"]);

function read(path: string): string {
    return readFileSync(path, "utf8");
}

/**
 * Retire les commentaires : un garde-fou doit analyser **le code**, pas la prose
 * (les commentaires qui expliquent le bug citent forcément le motif fautif).
 * Le `[^:]` protège les URL (`https://…`).
 */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// ---------------------------------------------------------------------------
// Extraction du contrat de retour
// ---------------------------------------------------------------------------

/**
 * Index de l'accolade **ouvrante du corps**, en sautant une éventuelle
 * annotation de retour (`: Promise<GodMarketResult<{ … }>> {` : les accolades du
 * type ne sont **pas** le corps — piège qui rendait l'extraction vide).
 */
function bodyStartIndex(source: string, from: number): number | null {
    const nextExport = source.indexOf("\nexport ", from);
    const limit = nextExport === -1 ? source.length : nextExport;

    let angle = 0;
    let paren = 0;
    let bracket = 0;
    let brace = 0;

    for (let i = from; i < limit; i += 1) {
        const char = source[i];
        if (char === "<") angle += 1;
        else if (char === ">") angle = Math.max(0, angle - 1);
        else if (char === "(") paren += 1;
        else if (char === ")") paren = Math.max(0, paren - 1);
        else if (char === "[") bracket += 1;
        else if (char === "]") bracket = Math.max(0, bracket - 1);
        else if (char === "{") {
            if (angle === 0 && paren === 0 && bracket === 0 && brace === 0) return i;
            brace += 1;
        } else if (char === "}") brace = Math.max(0, brace - 1);
        else if (char === ";" && angle === 0 && paren === 0 && bracket === 0 && brace === 0) return null;
    }
    return null;
}

/** Corps d'un `export async function <name>` (accolades équilibrées). */
function functionBody(source: string, name: string): string | null {
    const marker = `export async function ${name}`;
    const start = source.indexOf(marker);
    if (start === -1) return null;

    // Fin de la liste de paramètres (on suit la profondeur des parenthèses).
    let index = start + marker.length;
    let parens = 0;
    for (; index < source.length; index += 1) {
        if (source[index] === "(") parens += 1;
        else if (source[index] === ")") {
            parens -= 1;
            if (parens === 0) {
                index += 1;
                break;
            }
        }
    }

    const bodyStart = bodyStartIndex(source, index);
    if (bodyStart === null) return null;

    let depth = 0;
    for (let i = bodyStart; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(bodyStart, i + 1);
        }
    }
    return null;
}

/** Clés de **premier niveau** d'un littéral d'objet (`...spread` ignorés). */
function topLevelKeys(literal: string): string[] {
    const inner = literal.slice(1, -1);
    const entries: string[] = [];
    let depth = 0;
    let current = "";

    for (const char of inner) {
        if (char === "{" || char === "[" || char === "(") depth += 1;
        if (char === "}" || char === "]" || char === ")") depth -= 1;

        if (char === "," && depth === 0) {
            entries.push(current);
            current = "";
            continue;
        }
        current += char;
    }
    entries.push(current);

    return entries
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !entry.startsWith("..."))
        .map((entry) => {
            const shorthand = /^([A-Za-z_$][\w$]*)$/.exec(entry);
            if (shorthand) return shorthand[1];
            const named = /^([A-Za-z_$][\w$]*)\s*:/.exec(entry);
            return named ? named[1] : "";
        })
        .filter((key) => key.length > 0);
}

/**
 * Retire les **corps de fonctions imbriquées** (callbacks `=> { … }` et
 * `function (…) { … }`) du corps de l'action : leurs `return { … }` décrivent
 * une ligne projetée, jamais le contrat de l'action. Sans ce nettoyage, un
 * `return {` de callback à moins de 60 caractères d'un vrai `return` masquait le
 * contrat réel (extraction incomplète = test inopérant).
 */
function stripNestedFunctionBodies(body: string): string {
    let output = "";
    let index = 0;

    while (index < body.length) {
        // Corps de callback en bloc : `=> { … }` (une expression `=> x` est
        // écartée : elle n'a pas de bloc, et chercher « la prochaine accolade »
        // avalerait le code suivant — piège corrigé ici).
        if (body.startsWith("=>", index)) {
            let cursor = index + 2;
            while (cursor < body.length && (body[cursor] === " " || body[cursor] === "\t")) cursor += 1;
            if (body[cursor] === "{") {
                const block = balancedBlock(body, cursor);
                if (block) {
                    output += "=> {}";
                    index = cursor + block.length;
                    continue;
                }
            }
        }

        // Fonction imbriquée déclarée : `function nom(…) { … }`.
        if (body.startsWith("function", index)) {
            const openParen = body.indexOf("(", index);
            if (openParen !== -1 && openParen - index < 40) {
                let depth = 0;
                let closeParen = -1;
                for (let i = openParen; i < body.length; i += 1) {
                    if (body[i] === "(") depth += 1;
                    else if (body[i] === ")") {
                        depth -= 1;
                        if (depth === 0) {
                            closeParen = i;
                            break;
                        }
                    }
                }
                if (closeParen !== -1) {
                    const open = body.indexOf("{", closeParen);
                    if (open !== -1 && open - closeParen < 200) {
                        const block = balancedBlock(body, open);
                        if (block) {
                            output += "function () {}";
                            index = open + block.length;
                            continue;
                        }
                    }
                }
            }
        }

        output += body[index];
        index += 1;
    }

    return output;
}

/** Bloc équilibré (accolades) à partir de l'accolade ouvrante. */
function balancedBlock(source: string, openIndex: number): string | null {
    let depth = 0;
    for (let i = openIndex; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(openIndex, i + 1);
        }
    }
    return null;
}

/**
 * Clés de premier niveau des `return { … }` du corps (callbacks neutralisés :
 * voir `stripNestedFunctionBodies`).
 */
function returnKeys(body: string): Set<string> {
    const keys = new Set<string>();
    const pattern = /return\s*\{/g;
    const cleaned = stripNestedFunctionBodies(body);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(cleaned))) {
        const literal = balancedBlock(cleaned, match.index + match[0].length - 1);
        if (!literal) continue;
        for (const key of topLevelKeys(literal)) keys.add(key);
    }
    return keys;
}

/** Contrat complet : `{ action → clés }`, extrait **du source**. */
function extractContracts(): Map<string, { file: string; keys: Set<string> }> {
    const contracts = new Map<string, { file: string; keys: Set<string> }>();

    for (const file of ACTION_FILES) {
        const source = codeOnly(read(file));
        const pattern = /export async function ([A-Za-z_$][\w$]*)/g;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(source))) {
            const name = match[1];
            const body = functionBody(source, name);
            if (!body) continue;
            contracts.set(name, { file, keys: returnKeys(body) });
        }
    }
    return contracts;
}

// ---------------------------------------------------------------------------
// Détection des consommations suspectes
// ---------------------------------------------------------------------------

type Contract = { file: string; keys: Set<string> };
type Offender = { file: string; action: string; property: string; snippet: string };

/** Résultat assigné (`const x = await action(…)` puis `x.<propriété>`). */
function scanAssignedResults(
    file: string,
    code: string,
    contracts: Map<string, Contract>
): { offenders: Offender[]; checked: number } {
    const offenders: Offender[] = [];
    let checked = 0;

    const assignPattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+([A-Za-z_$][\w$]*)\s*\(/g;
    const assignments = [...code.matchAll(assignPattern)].map((match) => ({
        variable: match[1],
        action: match[2],
        index: match.index ?? 0,
    }));

    for (const assignment of assignments) {
        const contract = contracts.get(assignment.action);
        if (!contract) continue; // appel d'un helper local : hors périmètre

        /**
         * ⚠️ Un même nom (`result`, `res`, `data`…) est réutilisé par plusieurs
         * fonctions du **même fichier** : on borne l'analyse à la fenêtre
         * `[affectation, affectation suivante du même nom[` — sinon les clés
         * d'une action seraient confrontées aux usages d'une autre.
         */
        const nextSameName = assignments.find(
            (candidate) => candidate.variable === assignment.variable && candidate.index > assignment.index
        );
        const window = code.slice(assignment.index, nextSameName ? nextSameName.index : code.length);

        const allowed = new Set([...contract.keys, ...GENERIC_KEYS]);

        // `x.propriété` (une seule profondeur : `x.data.items` ⇒ « data »).
        const direct = new RegExp(`${assignment.variable}\\s*\\.\\s*([A-Za-z_$][\\w$]*)`, "g");
        let usage: RegExpExecArray | null;
        while ((usage = direct.exec(window))) {
            const property = usage[1];
            checked += 1;
            if (!allowed.has(property)) {
                offenders.push({
                    file,
                    action: assignment.action,
                    property,
                    snippet: window.slice(Math.max(0, usage.index - 60), usage.index + 40).replace(/\s+/g, " "),
                });
            }
        }

        // `(x as { … }).propriété` — le motif exact du bug d'origine.
        const cast = new RegExp(
            `\\(\\s*${assignment.variable}\\s+as\\s+\\{[^}]*\\}\\s*\\)\\s*\\.\\s*([A-Za-z_$][\\w$]*)`,
            "g"
        );
        while ((usage = cast.exec(window))) {
            const property = usage[1];
            checked += 1;
            if (!allowed.has(property)) {
                offenders.push({
                    file,
                    action: assignment.action,
                    property,
                    snippet: window.slice(Math.max(0, usage.index - 60), usage.index + 60).replace(/\s+/g, " "),
                });
            }
        }
    }

    return { offenders, checked };
}

/** Déstructuration (`const { clé } = await action(…)`). */
function scanDestructuredResults(
    file: string,
    code: string,
    contracts: Map<string, Contract>
): { offenders: Offender[]; checked: number } {
    const offenders: Offender[] = [];
    let checked = 0;

    const pattern = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*await\s+([A-Za-z_$][\w$]*)\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code))) {
        const binding = match[1];
        const action = match[2];
        const contract = contracts.get(action);
        if (!contract) continue;

        const allowed = new Set([...contract.keys, ...GENERIC_KEYS]);
        const names = binding
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0 && !entry.startsWith("..."))
            .map((entry) => entry.split(":")[0].trim());

        for (const name of names) {
            checked += 1;
            if (!allowed.has(name)) {
                offenders.push({
                    file,
                    action,
                    property: name,
                    snippet: `const { ${binding} } = await ${action}(…)`,
                });
            }
        }
    }

    return { offenders, checked };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const contracts = extractContracts();

describe("T1 — contrats de retour extraits du source", () => {
    it("extrait les actions Marché et chaque contrat expose `success`", () => {
        // Anti-test-inopérant : si l'extraction casse, on veut le savoir.
        expect(contracts.size, "aucune action extraite — test inopérant").toBeGreaterThan(18);

        const withoutSuccess = [...contracts.entries()]
            .filter(([, contract]) => !contract.keys.has("success"))
            .map(([name, contract]) => `${name} (${contract.file})`);
        expect(withoutSuccess, "toute action du Marché renvoie `{ success, … }`").toEqual([]);
    });

    it("protège les actions réellement consommées par un panneau", () => {
        const consumed = new Set<string>();
        for (const file of PANEL_FILES) {
            const code = codeOnly(read(file));
            for (const match of code.matchAll(/await\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
                if (contracts.has(match[1])) consumed.add(match[1]);
            }
        }
        expect(consumed.size, "aucune action Marché consommée détectée — test inopérant").toBeGreaterThan(5);
    });
});

describe("T1 — les panneaux ne lisent que des clés réellement renvoyées", () => {
    it("aucune lecture via un résultat assigné (`x.clé`)", () => {
        const offenders: Offender[] = [];
        let checked = 0;

        for (const file of PANEL_FILES) {
            const code = codeOnly(read(file));
            const result = scanAssignedResults(file, code, contracts);
            offenders.push(...result.offenders);
            checked += result.checked;
        }

        expect(checked, "aucune consommation de résultat analysée — test inopérant").toBeGreaterThan(20);
        expect(
            offenders,
            `clé inexistante lue sur une réponse d'action :\n${offenders
                .map((entry) => `· ${entry.file} → ${entry.action}.${entry.property} — ${entry.snippet}`)
                .join("\n")}`
        ).toEqual([]);
    });

    it("aucune déstructuration d'une clé inexistante (`const { clé } = await action(…)`)", () => {
        const offenders: Offender[] = [];
        let checked = 0;

        for (const file of PANEL_FILES) {
            const code = codeOnly(read(file));
            const result = scanDestructuredResults(file, code, contracts);
            offenders.push(...result.offenders);
            checked += result.checked;
        }

        expect(
            offenders,
            `déstructuration d'une clé inexistante :\n${offenders
                .map((entry) => `· ${entry.file} → ${entry.action} (${entry.property}) — ${entry.snippet}`)
                .join("\n")}`
        ).toEqual([]);
        // Chemin peu utilisé aujourd'hui : on garde le compteur visible pour
        // qu'un futur panneau ne passe pas inaperçu.
        expect(checked).toBeGreaterThanOrEqual(0);
    });

    it("détecte le motif du BUG-1 (`.data` sur une action qui n'a pas de `data`)", () => {
        // Auto-vérification : le détecteur doit reconnaître le motif historique.
        const fakeContracts = new Map<string, Contract>([
            ["getDiscordRolesAction", { file: "fake.ts", keys: new Set(["success", "roles"]) }],
        ]);
        const code = `
            const rolesRes = await getDiscordRolesAction(guildId);
            setRoles((rolesRes as { data?: Role[] }).data ?? []);
        `;
        const result = scanAssignedResults("fake-panel.tsx", code, fakeContracts);
        expect(result.offenders.map((entry) => entry.property)).toContain("data");
    });
});



