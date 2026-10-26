/**
 * **Conditions d'équipement DOFUS** — évaluation d'un arbre **structuré** (DofusDude).
 *
 * 🎯 Pourquoi cette source ? Le DSL DofusDB (`criterions` : `CP<12|CM<6`, `pk<2`) utilise des
 * codes courts non documentés. DofusDude expose le **même** contenu en arbre avec des **noms
 * français** (`PA`, `PM`, `Sagesse`, `Bonus de panoplies`…), des opérateurs et `and`/`or`.
 * Mesure du 25/10/2026 sur les **4 095** équipements (264 portent une condition) :
 * éléments `PA, PM, Vitalité, Sagesse, Force, Intelligence, Chance, Agilité,
 * Bonus de panoplies, Être abonné, Être niveau {0} ou plus, Kamas, Niveau d'alignement`,
 * opérateurs `< = >`, relations `and`/`or`.
 *
 * ⚠️ **Fail-closed** : un élément hors du contexte d'un stuff (kamas, abonnement, alignement)
 * ou un opérateur inconnu rend `ok:false` avec la liste `unsupported` — on ne devine jamais.
 * Le libellé, lui, reste **fidèle à la source** (nom renvoyé par l'API).
 */

/** Valeurs d'un build **effectif** (stuff + variantes), utilisées pour évaluer. */
export interface DofusConditionContext {
    pa: number;
    pm: number;
    vit: number;
    sa: number;
    fo: number;
    in: number;
    ch: number;
    ag: number;
    /** Panoplies **actives** (≥ 2 pièces distinctes) — élément « Bonus de panoplies ». */
    activeSets: number;
    level: number;
}

type RawElement = { name?: string; id?: number } | string | null | undefined;

export interface RawConditionNode {
    is_operand?: boolean;
    relation?: string;
    children?: RawConditionNode[];
    condition?: { operator?: string; int_value?: number; element?: RawElement };
}

export interface ConditionsEvaluation {
    /**
     * L'arbre est-il **satisfait** ? (fail-closed : une condition non évaluable rend sa branche
     * fausse, donc un arbre qui n'a **que** des branches non évaluables rend `false`).
     * Pour un OU, `failed`/`unsupported` restent **informatifs** : ils listent les branches
     * qui n'ont pas suffi, même si une autre branche satisfait la condition.
     */
    ok: boolean;
    /** Rendu français fidèle (« PA < 12 ou PM < 6 », « Bonus de panoplies < 2 »). */
    text: string;
    /** Conditions évaluées **fausses** (rendu). */
    failed: string[];
    /** Éléments hors contexte d'un stuff (rendu) — rendent `ok:false`. */
    unsupported: string[];
}

/**
 * Élément (nom FR de l'API) → champ du contexte. On ne mappe que ce qu'un **stuff** permet de
 * calculer : les conditions « Kamas / abonnement / alignement » restent non évaluables.
 */
const ELEMENT_CONTEXT: Record<string, keyof DofusConditionContext> = {
    PA: "pa",
    PM: "pm",
    Vitalité: "vit",
    Sagesse: "sa",
    Force: "fo",
    Intelligence: "in",
    Chance: "ch",
    Agilité: "ag",
    "Bonus de panoplies": "activeSets",
};

const KNOWN_OPERATORS = new Set(["<", "<=", ">", ">=", "=", "!="]);

/** L'API renvoie parfois `{name}` et parfois la chaîne `"@{name=PA; id=12}"`. */
export function readElementName(element: RawElement): string {
    if (!element) return "";
    if (typeof element === "string") {
        const match = /name=([^;]+)/.exec(element);
        return (match ? match[1] : element).trim();
    }
    return String(element.name ?? "").trim();
}

function compare(left: number, operator: string, right: number): boolean {
    switch (operator) {
        case "<": return left < right;
        case "<=": return left <= right;
        case ">": return left > right;
        case ">=": return left >= right;
        case "=": return left === right;
        case "!=": return left !== right;
        default: return false;
    }
}


interface EvalNode {
    text: string;
    satisfied: boolean;
    failed: string[];
    unsupported: string[];
}

function evalNode(node: RawConditionNode, context: DofusConditionContext): EvalNode {
    if (Array.isArray(node.children) && node.children.length > 0) {
        const relation = (node.relation ?? "and").toLowerCase();
        const results = node.children.map((child) => evalNode(child, context));
        const text = results
            .map((result) => result.text)
            .filter(Boolean)
            .join(relation === "or" ? " ou " : " et ");
        const failed = results.flatMap((result) => result.failed);
        const unsupported = results.flatMap((result) => result.unsupported);

        const clean = (result: EvalNode) =>
            result.satisfied && result.failed.length === 0 && result.unsupported.length === 0;
        const satisfied = relation === "or" ? results.some(clean) : results.every(clean);

        return { text, satisfied, failed, unsupported };
    }

    const raw = node.condition;
    if (!raw) return { text: "", satisfied: true, failed: [], unsupported: [] };

    const element = readElementName(raw.element);
    const operator = String(raw.operator ?? "").trim();
    const value = Number(raw.int_value);
    const rendered = `${element} ${operator} ${Number.isFinite(value) ? value : "?"}`;

    if (!element || !KNOWN_OPERATORS.has(operator) || !Number.isFinite(value)) {
        return { text: rendered, satisfied: false, failed: [], unsupported: [rendered] };
    }

    const contextKey = ELEMENT_CONTEXT[element];
    if (!contextKey) {
        // Hors contexte d'un stuff (kamas, abonnement, alignement…) : non évaluable ⇒ refus.
        return { text: rendered, satisfied: false, failed: [], unsupported: [rendered] };
    }

    const result = compare(Number(context[contextKey]), operator, value);
    return {
        text: rendered,
        satisfied: result,
        failed: result ? [] : [rendered],
        unsupported: [],
    };
}

/** Contexte neutre — sert au **rendu** (le texte ne dépend pas des valeurs). */
const ZERO_CONTEXT: DofusConditionContext = {
    pa: 0, pm: 0, vit: 0, sa: 0, fo: 0, in: 0, ch: 0, ag: 0, activeSets: 0, level: 0,
};

/**
 * Rendu français d'un arbre de conditions, **sans** évaluation
 * (affichage « PA < 12 ou PM < 6 »). `""` si aucune condition.
 */
export function renderDofusConditions(raw: unknown): string {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
    return evalNode(raw as RawConditionNode, ZERO_CONTEXT).text;
}

/**
 * Évalue un arbre `conditions` (`GameItem.conditions`) contre un build effectif.
 * Arbre vide / `null` ⇒ `ok:true`, texte vide.
 */
export function evaluateDofusConditions(
    raw: unknown,
    context: DofusConditionContext,
): ConditionsEvaluation {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: true, text: "", failed: [], unsupported: [] };
    }

    const result = evalNode(raw as RawConditionNode, context);
    if (!result.text) return { ok: true, text: "", failed: [], unsupported: [] };

    return {
        // La satisfaction vient de l'arbre (OU : une branche propre suffit). `failed` et
        // `unsupported` restent exposés pour le message d'erreur, sans invalider un OU satisfait.
        ok: result.satisfied,
        text: result.text,
        failed: result.failed,
        unsupported: result.unsupported,
    };
}
