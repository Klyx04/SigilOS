/**
 * 🧩 **Veille des conditions d'équipement** — compteur d'inconnues (règle pure).
 *
 * 🎯 Pourquoi : `evaluateDofusConditions` refuse une condition qu'il ne sait pas évaluer
 * (fail-closed), mais ce refus était **silencieux au niveau agrégé** — impossible de savoir
 * qu'Ankama avait introduit un nouvel élément ou opérateur. Ici on compte, par élément et par
 * opérateur, ce que le référentiel **ne sait pas** traiter, pour que le God soit alerté **avant**
 * que les variantes se mettent à refuser en masse.
 *
 * Source de la mesure (25/10/2026, 4 095 équipements dont 264 conditionnés) : éléments
 * `PA, PM, Vitalité, Sagesse, Force, Intelligence, Chance, Agilité, Bonus de panoplies,
 * Être abonné, Être niveau {0} ou plus, Kamas, Niveau d'alignement`, opérateurs `< = >`,
 * relations `and`/`or`.
 */

import { listConditionAtoms } from "@/lib/dofus-conditions";
import { unknownVariantItemTypes } from "@/lib/dofus-variant-rules";

/** Compteur d'un couple élément + opérateur **non évaluable**. */
export interface ConditionUnknownBucket {
    element: string;
    operator: string;
    count: number;
}

/** Instantané de veille — persisté dans Redis et affiché au God (aucune migration). */
export interface ItemConditionsWatchSummary {
    /** Objets du catalogue portant une condition. */
    items: number;
    /** Atomes de condition lus (toutes branches confondues). */
    atoms: number;
    /** Atomes **non évaluables** (élément hors contexte, opérateur inconnu, valeur absente). */
    unknownAtoms: number;
    /** Détail par élément + opérateur, trié par fréquence décroissante. */
    unknown: ConditionUnknownBucket[];
    /**
     * Types d'objet du catalogue **hors** `VARIANT_SLOTS` : la recherche de variante ne les
     * proposerait pas. La veille les **signale**, elle ne les ajoute pas d'office.
     */
    unknownTypes: string[];
    /** Date du calcul (ISO). */
    computedAt: string;
}

/**
 * Agrège les inconnues d'un lot de conditions (`GameItem.conditions`).
 *
 * @param conditions arbres bruts, tels que stockés en base (jamais supposés valides)
 * @param typeNames  types d'objet du catalogue (facultatif — Lot E « types/slots »)
 */
export function summarizeItemConditions(
    conditions: readonly unknown[],
    typeNames: readonly string[] = [],
    now: Date = new Date(),
): ItemConditionsWatchSummary {
    const buckets = new Map<string, ConditionUnknownBucket>();
    let items = 0;
    let atoms = 0;
    let unknownAtoms = 0;

    for (const raw of conditions) {
        const parsed = listConditionAtoms(raw);
        if (parsed.length === 0) continue;
        items += 1;
        atoms += parsed.length;

        for (const atom of parsed) {
            if (atom.supported) continue;
            unknownAtoms += 1;
            const key = `${atom.element}|${atom.operator}`;
            const bucket = buckets.get(key) ?? { element: atom.element, operator: atom.operator, count: 0 };
            bucket.count += 1;
            buckets.set(key, bucket);
        }
    }

    const unknown = [...buckets.values()].sort(
        (a, b) => b.count - a.count || a.element.localeCompare(b.element) || a.operator.localeCompare(b.operator),
    );

    return {
        items,
        atoms,
        unknownAtoms,
        unknown,
        unknownTypes: unknownVariantItemTypes(typeNames),
        computedAt: now.toISOString(),
    };
}

/**
 * Inconnues **jamais vues** (élément + opérateur) — c'est ce qui déclenche l'alerte God.
 * `previous` vide/absent ⇒ tout est nouveau (première passe : on informe sans crier au loup
 * côté appelant, qui décide).
 */
export function newUnknownBuckets(
    previous: readonly ConditionUnknownBucket[] | null | undefined,
    current: readonly ConditionUnknownBucket[],
): ConditionUnknownBucket[] {
    const seen = new Set((previous ?? []).map((bucket) => `${bucket.element}|${bucket.operator}`));
    return current.filter((bucket) => !seen.has(`${bucket.element}|${bucket.operator}`));
}

/**
 * Types d'objet **jamais vus** depuis le dernier instantané.
 *
 * ⚠️ Le catalogue contient des types `equipment` qui ne se **portent pas** (caution, certificat,
 * bannière de percepteur…). Les signaler à chaque passe noierait le vrai signal : seule une
 * **nouveauté** déclenche l'alerte, le reste vit dans l'instantané (consultable).
 */
export function newUnknownTypes(
    previous: readonly string[] | null | undefined,
    current: readonly string[],
): string[] {
    const seen = new Set((previous ?? []).map((type) => type.toLowerCase()));
    return current.filter((type) => !seen.has(type.toLowerCase()));
}

/** Deux instantanés portent-ils la même mesure ? (évite une écriture Redis inutile) */
export function sameItemConditionsWatch(
    a: ItemConditionsWatchSummary | null | undefined,
    b: ItemConditionsWatchSummary,
): boolean {
    if (!a) return false;
    return a.items === b.items
        && a.atoms === b.atoms
        && a.unknownAtoms === b.unknownAtoms
        && a.unknownTypes.join("|") === b.unknownTypes.join("|")
        && a.unknown.map((x) => `${x.element}|${x.operator}|${x.count}`).join(";")
            === b.unknown.map((x) => `${x.element}|${x.operator}|${x.count}`).join(";");
}
