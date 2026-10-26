/**
 * Import consolidé d'un guide Rush — **règle pure** (`S4-4`).
 *
 * Le studio God sait créer un bloc et une quête, un par un. Ce module calcule ce
 * qu'un **payload exporté** (le `export-god.json` de l'outil local, ou un JSON
 * écrit à la main) ajouterait au guide **sans rien supprimer ni réécrire** :
 * c'est le *dry-run*. Le serveur applique ensuite exactement ce plan.
 *
 * Règles de rapprochement (jamais de fusion silencieuse) :
 *
 * | Élément | Clé | Conséquence |
 * |---|---|---|
 * | bloc | `title` normalisé (casse, accents, ponctuation) | existant ⇒ réutilisé, sinon créé |
 * | quête | `subGuideName` normalisé **dans son bloc** | existante ⇒ laissée telle quelle, sinon créée |
 * | doublon dans le payload | même nom dans le même bloc | la 2ᵉ occurrence est **écartée** (avertissement) |
 *
 * Aucune mise à jour de l'existant : l'import **ajoute**, il ne réécrit pas. Un
 * texte déjà saisi dans God ne peut donc pas être écrasé par une source externe.
 */

import { normalizeOrderCode } from "@/lib/rush-order-codes";

export type RushImportSequence = {
    subGuideName: string;
    questDbIds?: number[];
    alignReq?: string | null;
    alignOrderCode?: string | null;
    alignLevelReq?: number | null;
    classReq?: string | null;
    dungeonIds?: string[];
    dungeonOptionalIds?: string[];
    takeEarly?: boolean;
    isOptional?: boolean;
    tips?: string | null;
    note?: string | null;
};

export type RushImportBlock = {
    title: string;
    order?: number;
    sequences: RushImportSequence[];
};

export type RushImportPayload = { blocks: RushImportBlock[] };

export type RushImportCurrent = {
    milestones: Array<{
        id: string;
        title: string;
        sequences: Array<{ id: string; subGuideName: string }>;
    }>;
};

export type RushImportOptions = {
    /** Donjons connus (`Dungeon.id`) : un id inconnu est signalé, jamais deviné. */
    knownDungeonIds?: ReadonlySet<string>;
    /** Classes connues (`classReq`) : même principe. */
    knownClassIds?: ReadonlySet<string>;
};

export type RushImportSequencePlan = {
    name: string;
    status: "new" | "existing" | "skipped";
    existingSequenceId: string | null;
    warnings: string[];
};

export type RushImportBlockPlan = {
    title: string;
    status: "new" | "existing";
    existingMilestoneId: string | null;
    sequences: RushImportSequencePlan[];
    /** Nombre de quêtes réellement créées par l'import pour ce bloc. */
    toCreate: number;
};

export type RushImportPlan = {
    blocks: RushImportBlockPlan[];
    totals: {
        blocksNew: number;
        blocksExisting: number;
        sequencesNew: number;
        sequencesExisting: number;
        sequencesSkipped: number;
    };
    warnings: string[];
};

/** Minuscule, sans accents, ponctuation réduite : clé de rapprochement des libellés. */
export function importKey(value: string | null | undefined): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/** Valeur de cité reconnue, ou `null` (une cité inconnue n'est pas écrite). */
function cite(value: string | null | undefined): "bontarien" | "brakmarien" | null {
    const key = importKey(value);
    if (key.startsWith("bont")) return "bontarien";
    if (key.startsWith("brak")) return "brakmarien";
    return null;
}

/**
 * Calcule le plan d'import : ce qui existe déjà, ce qui serait créé, et ce qui
 * pose problème. **Aucune écriture**, aucune mutation des entrées.
 */
export function planRushImport(
    payload: RushImportPayload,
    current: RushImportCurrent,
    options: RushImportOptions = {}
): RushImportPlan {
    const milestonesByTitle = new Map<string, RushImportCurrent["milestones"][number]>();
    for (const milestone of current.milestones) milestonesByTitle.set(importKey(milestone.title), milestone);

    const warnings: string[] = [];
    const blocks: RushImportBlockPlan[] = [];
    const totals = { blocksNew: 0, blocksExisting: 0, sequencesNew: 0, sequencesExisting: 0, sequencesSkipped: 0 };

    for (const block of payload.blocks ?? []) {
        const blockKey = importKey(block.title);
        if (!blockKey) {
            warnings.push("Un bloc sans titre a été écarté.");
            continue;
        }

        const existingMilestone = milestonesByTitle.get(blockKey) ?? null;
        const existingByName = new Map(
            (existingMilestone?.sequences ?? []).map((sequence) => [importKey(sequence.subGuideName), sequence])
        );
        const seenInPayload = new Set<string>();
        const sequences: RushImportSequencePlan[] = [];

        for (const sequence of block.sequences ?? []) {
            const name = (sequence.subGuideName ?? "").trim();
            const nameKey = importKey(name);
            const sequenceWarnings: string[] = [];

            if (!nameKey) {
                sequences.push({ name, status: "skipped", existingSequenceId: null, warnings: ["Nom vide : quête écartée."] });
                totals.sequencesSkipped += 1;
                continue;
            }

            // Contenu de la quête : on signale ce qui ne se rattache à rien de connu.
            const citeBrute = (sequence.alignReq ?? "").trim();
            if (citeBrute && !cite(citeBrute)) sequenceWarnings.push(`Cité inconnue « ${citeBrute} » : la quête sera commune.`);
            const ordreBrut = (sequence.alignOrderCode ?? "").trim();
            if (ordreBrut && !normalizeOrderCode(ordreBrut)) {
                sequenceWarnings.push(`Ordre inconnu « ${ordreBrut} » : aucune route ne l'affichera.`);
            }
            const classe = (sequence.classReq ?? "").trim();
            if (classe && options.knownClassIds && !options.knownClassIds.has(classe.toLowerCase())) {
                sequenceWarnings.push(`Classe inconnue « ${classe} ».`);
            }
            for (const dungeonId of sequence.dungeonIds ?? []) {
                if (options.knownDungeonIds && !options.knownDungeonIds.has(dungeonId)) {
                    sequenceWarnings.push(`Donjon inconnu « ${dungeonId} » : il sera ignoré.`);
                }
            }

            if (seenInPayload.has(nameKey)) {
                sequences.push({
                    name,
                    status: "skipped",
                    existingSequenceId: null,
                    warnings: [...sequenceWarnings, "Doublon dans le fichier : la 1ʳᵉ occurrence gagne."],
                });
                totals.sequencesSkipped += 1;
                continue;
            }
            seenInPayload.add(nameKey);

            if (existingByName.has(nameKey)) {
                sequences.push({
                    name,
                    status: "existing",
                    existingSequenceId: existingByName.get(nameKey)?.id ?? null,
                    warnings: [...sequenceWarnings, "Déjà dans le guide : laissée telle quelle."],
                });
                totals.sequencesExisting += 1;
                continue;
            }

            sequences.push({ name, status: "new", existingSequenceId: null, warnings: sequenceWarnings });
            totals.sequencesNew += 1;
        }

        const toCreate = sequences.filter((sequence) => sequence.status === "new").length;
        if (existingMilestone) totals.blocksExisting += 1;
        else totals.blocksNew += 1;

        blocks.push({
            title: block.title.trim(),
            status: existingMilestone ? "existing" : "new",
            existingMilestoneId: existingMilestone?.id ?? null,
            sequences,
            toCreate,
        });
    }

    return { blocks, totals, warnings };
}

/** Vrai si le plan n'écrirait rien (idempotence : un second passage est un no-op). */
export function isRushImportNoop(plan: RushImportPlan): boolean {
    return plan.blocks.every((block) => block.status === "existing" && block.toCreate === 0);
}

