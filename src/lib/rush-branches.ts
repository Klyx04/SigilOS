/**
 * Rush Sylvestre — **vue Branches à deux étages** (cité → Ordre), règle pure.
 *
 * Mesure de référence (21/10/2026, `docs/plans/MODULE-RUSH-SYLESTRE.md` § F2) :
 *  · **100** quêtes de cité côté Bontarien (100ᵉ = « L'exorciste »), **102** côté Brâkmarien
 *    (102ᵉ = « La danse macabre ») ;
 *  · le miroir vaut **par position** tant que les deux séries avancent ensemble : les positions
 *    101-102 n'ont **pas** de jumelle côté Bonta (ce n'est pas un manque) ;
 *  · **3 Ordres par cité**, **5 quêtes d'Apprentissage** chacun (seuils 20/40/60/80/100), avec un
 *    **nom propre par Ordre** ⇒ **30 quêtes d'Ordre**.
 *
 * Cette règle ne lit rien, n'écrit rien : elle range ce que le chargeur God a déjà ramené.
 * Les séquences d'Ordre ne comptent **jamais** dans une série de cité (piège mesuré : sans ce
 * filtre, la cible 100/102 est atteinte à tort).
 */

import { ORDERS } from "@/lib/dofus-assets";
import { normalizeAlignmentCamp, type RushAlignmentCamp } from "@/lib/rush-route";

/** Cible mesurée par cité (Tougli, 21/10/2026). */
export const RUSH_CAMP_TARGETS: Record<RushAlignmentCamp, number> = {
    bontarien: 100,
    brakmarien: 102,
};

/** Seuils d'Apprentissage des quêtes d'Ordre. */
export const RUSH_ORDER_LEVELS = [20, 40, 60, 80, 100] as const;
export type RushOrderLevel = (typeof RUSH_ORDER_LEVELS)[number];

export type RushBranchSequence = {
    id: string;
    order: number;
    subGuideName: string;
    alignReq?: string | null;
    alignOrderCode?: string | null;
    alignLevelReq?: number | null;
};

export type RushBranchPair = {
    /** Position 1..N dans la série de cité (le miroir se lit à position égale). */
    position: number;
    bontarien?: RushBranchSequence;
    brakmarien?: RushBranchSequence;
};

export type RushOrderSlot = {
    level: RushOrderLevel;
    /** Nom propre du palier pour cet Ordre (« Disciple de Ménalt »…). */
    label: string;
    sequences: RushBranchSequence[];
};

export type RushBranchOrder = {
    id: string;
    name: string;
    icon: string;
    slots: RushOrderSlot[];
    /** Emplacements vides (0 = branche complète). */
    missing: number;
    /** Quêtes de cet Ordre sans palier renseigné (signalées, jamais comptées comme remplies). */
    unlevelled: RushBranchSequence[];
};

export type RushBranchCamp = {
    camp: RushAlignmentCamp;
    label: string;
    target: number;
    present: number;
    /** Quêtes manquantes pour atteindre la cible. */
    missing: number;
    /** Positions au-delà du plus petit des deux totaux (hors miroir, pas des manques). */
    beyondMirror: number;
    orders: RushBranchOrder[];
};

export type RushBranchesView = {
    camps: [RushBranchCamp, RushBranchCamp];
    pairs: RushBranchPair[];
    /** Séquences dont la cité ou l'Ordre n'est pas reconnu (jamais perdues en silence). */
    orphans: RushBranchSequence[];
    /** Séries complètes ? (bontarien = 100 ET brâkmarien = 102) */
    complete: boolean;
};

const CAMP_LABELS: Record<RushAlignmentCamp, string> = {
    bontarien: "Bontarien",
    brakmarien: "Brâkmarien",
};

const CAMPS: RushAlignmentCamp[] = ["bontarien", "brakmarien"];

/** Tri stable : `order` puis nom puis id (l'ordre d'entrée ne doit rien changer). */
function sortSequences(list: RushBranchSequence[]): RushBranchSequence[] {
    return [...list].sort(
        (a, b) =>
            a.order - b.order ||
            a.subGuideName.localeCompare(b.subGuideName, "fr") ||
            a.id.localeCompare(b.id),
    );
}

function normalizeLevel(value: number | null | undefined): RushOrderLevel | null {
    const level = Number(value);
    return (RUSH_ORDER_LEVELS as readonly number[]).includes(level) ? (level as RushOrderLevel) : null;
}

/**
 * Range les séquences du guide en deux étages.
 *
 * @param sequences toutes les séquences du guide, toutes cités/Ordres confondus.
 */
export function buildRushBranches(sequences: readonly RushBranchSequence[]): RushBranchesView {
    const orphans: RushBranchSequence[] = [];
    const campQuests: Record<RushAlignmentCamp, RushBranchSequence[]> = { bontarien: [], brakmarien: [] };
    const orderQuests: Record<RushAlignmentCamp, RushBranchSequence[]> = { bontarien: [], brakmarien: [] };

    for (const seq of sequences) {
        const raw = (seq.alignReq ?? "").trim();
        if (!raw) continue; // quête commune : hors branches

        const camp = normalizeAlignmentCamp(raw);
        if (!camp) {
            orphans.push(seq); // fail-closed : jamais rattachée d'office
            continue;
        }
        const hasOrder = !!(seq.alignOrderCode ?? "").trim();
        if (hasOrder) orderQuests[camp].push(seq);
        else campQuests[camp].push(seq);
    }

    const sortedCamp: Record<RushAlignmentCamp, RushBranchSequence[]> = {
        bontarien: sortSequences(campQuests.bontarien),
        brakmarien: sortSequences(campQuests.brakmarien),
    };

    // Étage 1 — paires alignées **par position**.
    const pairCount = Math.max(sortedCamp.bontarien.length, sortedCamp.brakmarien.length);
    const mirrorLimit = Math.min(RUSH_CAMP_TARGETS.bontarien, RUSH_CAMP_TARGETS.brakmarien);
    const pairs: RushBranchPair[] = [];
    for (let i = 0; i < pairCount; i += 1) {
        pairs.push({
            position: i + 1,
            bontarien: sortedCamp.bontarien[i],
            brakmarien: sortedCamp.brakmarien[i],
        });
    }

    // Étage 2 — 3 Ordres × 5 paliers par cité.
    const camps = CAMPS.map((camp): RushBranchCamp => {
        const catalog = (ORDERS as unknown as Record<
            string,
            Array<{ id: string; name: string; icon: string; levels: Record<number, string> }>
        >)[camp] ?? [];
        const ownQuests = orderQuests[camp];
        const knownOrderIds = new Set(catalog.map((o) => o.id.toLowerCase()));

        // Un code d'Ordre inconnu du catalogue ne se fond dans aucun autre : il est signalé.
        for (const seq of ownQuests) {
            const code = (seq.alignOrderCode ?? "").trim().toLowerCase();
            if (!knownOrderIds.has(code)) orphans.push(seq);
        }

        const orders: RushBranchOrder[] = catalog.map((order) => {
            const mine = ownQuests.filter(
                (seq) => (seq.alignOrderCode ?? "").trim().toLowerCase() === order.id.toLowerCase(),
            );
            const unlevelled: RushBranchSequence[] = [];
            const slots: RushOrderSlot[] = RUSH_ORDER_LEVELS.map((level) => ({
                level,
                label: order.levels?.[level] ?? `Palier ${level}`,
                sequences: [],
            }));

            for (const seq of sortSequences(mine)) {
                const level = normalizeLevel(seq.alignLevelReq);
                const slot = level ? slots.find((s) => s.level === level) : undefined;
                if (slot) slot.sequences.push(seq);
                else unlevelled.push(seq);
            }

            return {
                id: order.id,
                name: order.name,
                icon: order.icon,
                slots,
                missing: slots.filter((s) => s.sequences.length === 0).length,
                unlevelled,
            };
        });

        const target = RUSH_CAMP_TARGETS[camp];
        const present = sortedCamp[camp].length;

        return {
            camp,
            label: CAMP_LABELS[camp],
            target,
            present,
            missing: Math.max(0, target - present),
            beyondMirror: Math.max(0, present - mirrorLimit),
            orders,
        };
    }) as [RushBranchCamp, RushBranchCamp];

    return {
        camps,
        pairs,
        orphans: sortSequences(orphans),
        complete: camps.every((c) => c.present >= c.target),
    };
}

/** Emplacements d'Ordre vides au total (cible : 6 Ordres × 5 paliers). */
export function countMissingOrderSlots(view: RushBranchesView): number {
    return view.camps.reduce((total, camp) => total + camp.orders.reduce((n, order) => n + order.missing, 0), 0);
}
