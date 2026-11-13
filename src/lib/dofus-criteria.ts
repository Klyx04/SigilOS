/**
 * **Conditions d'équipement Dofus** — parseur du DSL `criterions` de DofusDB.
 *
 * 🎯 Mesures du 25/10/2026 (DofusDB `/items`, croisées avec les tooltips Dofusbook) :
 *   · `Heaume Oplate` → `CP<12|CM<6` = « **PA < 12 ou PM < 6** » (Dofusbook affiche `ou`) ;
 *   · `Dévastateur Feu majeur` → `pk<2` = « **Bonus de panoplies < 2** » (panoplies actives).
 *
 * ⚠️ **Fail-closed** : un code, un opérateur ou une syntaxe non reconnus ⇒ `ok:false` avec la
 * chaîne brute. On n'affiche **jamais** une condition inventée, et un appelant qui doit décider
 * (légalité de variante) **refuse** dans ce cas.
 *
 * Les codes ne sont mappés que lorsqu'ils sont **mesurés** (voir `CRITERIA_LABELS`). Les autres
 * restent bruts (`unsupported`) jusqu'à mesure — jamais devinés.
 */

/** Opérateurs du DSL. */
export type CriteriaOperator = "<" | "<=" | ">" | ">=" | "=" | "~";

export interface CriteriaComparison {
    /** Code brut du DSL (`CP`, `CM`, `pk`…). */
    code: string;
    operator: CriteriaOperator;
    value: string;
}

export type CriteriaNode =
    | { kind: "comparison"; comparison: CriteriaComparison }
    | { kind: "and"; children: CriteriaNode[] }
    | { kind: "or"; children: CriteriaNode[] };

export type ParseCriteriaResult =
    | { ok: true; node: CriteriaNode; conditions: CriteriaComparison[]; text: string }
    | { ok: false; reason: string; raw: string; unsupported?: string[] };

/**
 * Libellés **mesurés** (jamais devinés) : `CP`/`CM` confirmés par le tooltip du Heaume Oplate,
 * `pk` par celui du Dévastateur Feu majeur.
 */
export const CRITERIA_LABELS: Record<string, string> = {
    CP: "PA",
    CM: "PM",
    pk: "Panoplies actives",
};

const COMPARISON_RE = /^([A-Za-z]{1,4})(<=|>=|<|>|=|~)([-A-Za-z0-9_]+)$/;
const OPERATORS: CriteriaOperator[] = ["<=", ">=", "<", ">", "=", "~"];

function renderOperator(operator: CriteriaOperator): string {
    switch (operator) {
        case "<": return "<";
        case "<=": return "≤";
        case ">": return ">";
        case ">=": return "≥";
        case "=": return "=";
        case "~": return "contient";
    }
}

/** Découpe une expression `a&b|c` en respectant la priorité usuelle (`&` avant `|`). */
function parseExpression(raw: string): ParseCriteriaResult {
    const orParts = raw.split("|").map((part) => part.trim()).filter(Boolean);
    if (orParts.length === 0) {
        return { ok: false, reason: "expression vide", raw };
    }

    const orChildren: CriteriaNode[] = [];
    const conditions: CriteriaComparison[] = [];
    const unsupported: string[] = [];

    for (const orPart of orParts) {
        const andParts = orPart.split("&").map((part) => part.trim()).filter(Boolean);
        if (andParts.length === 0) return { ok: false, reason: "expression vide", raw };

        const andChildren: CriteriaNode[] = [];
        for (const token of andParts) {
            const match = COMPARISON_RE.exec(token);
            if (!match) return { ok: false, reason: `syntaxe non gérée : « ${token} »`, raw };

            const [, code, operator, value] = match;
            if (!CRITERIA_LABELS[code]) {
                unsupported.push(code);
                continue;
            }
            const comparison: CriteriaComparison = {
                code,
                operator: operator as CriteriaOperator,
                value,
            };
            conditions.push(comparison);
            andChildren.push({ kind: "comparison", comparison });
        }

        if (andChildren.length === 1) orChildren.push(andChildren[0]);
        else if (andChildren.length > 1) orChildren.push({ kind: "and", children: andChildren });
    }

    if (unsupported.length > 0) {
        return {
            ok: false,
            reason: `code(s) non mesuré(s) : ${[...new Set(unsupported)].join(", ")}`,
            raw,
            unsupported: [...new Set(unsupported)],
        };
    }
    if (orChildren.length === 0) {
        return { ok: false, reason: "expression vide", raw };
    }

    const node: CriteriaNode = orChildren.length === 1 ? orChildren[0] : { kind: "or", children: orChildren };
    return { ok: true, node, conditions, text: renderCriteriaNode(node) };
}

function renderCriteriaNode(node: CriteriaNode): string {
    if (node.kind === "comparison") {
        const { code, operator, value } = node.comparison;
        return `${CRITERIA_LABELS[code] ?? code} ${renderOperator(operator)} ${value}`;
    }
    const glue = node.kind === "and" ? " et " : " ou ";
    return node.children.map(renderCriteriaNode).join(glue);
}

/**
 * Parse une chaîne `criterions` DofusDB.
 * `""` ⇒ `ok:true` sans condition (un objet sans condition est valide).
 */
export function parseDofusCriterions(raw: string | null | undefined): ParseCriteriaResult {
    const value = (raw ?? "").trim();
    if (value.length === 0) {
        return { ok: true, node: { kind: "and", children: [] }, conditions: [], text: "" };
    }
    return parseExpression(value);
}

/**
 * Rend une condition **Dofusbook** (`constraints`, structure `{name, sign, value}`) en français :
 * `[{pa,<,12},{pm,<,6}]` ⇒ « PA < 12 ou PM < 6 » (Dofusbook joint par « ou »).
 * Un `name` inconnu est laissé en majuscules — jamais traduit au hasard.
 */
export function renderDofusbookConstraints(
    constraints: Array<{ name?: string; sign?: string; value?: string | number }> | null | undefined,
): string {
    if (!Array.isArray(constraints) || constraints.length === 0) return "";

    const parts = constraints
        .filter((entry) => !!entry && !!entry.name)
        .map((entry) => {
            const code = String(entry.name);
            const label = CRITERIA_LABELS[code] ?? CRITERIA_LABELS[code.toUpperCase()] ?? code.toUpperCase();
            const operator = (entry.sign ?? "") as CriteriaOperator;
            const rendered = OPERATORS.includes(operator) ? renderOperator(operator) : (entry.sign ?? "");
            return `${label} ${rendered} ${entry.value ?? ""}`.trim();
        });

    return parts.join(" ou ");
}

