/**
 * Veille **souveraine** des classes Dofus — cœur exécutable sans session Next
 * (cron, worker BullMQ, conteneur `ops-*`).
 *
 * Ce que le veilleur fait :
 *  1. lit `/breeds` **prod** (vérité live) et **bêta** (aperçu) ;
 *  2. compare au manifeste précédent et au registre `DOFUS_CLASSES` ;
 *  3. télécharge l'icône d'une classe **non encore dans le code** dans le volume
 *     `/uploads/assets-dofus/classes/<breed>.webp` (persistant, sans redéploiement) ;
 *  4. écrit un manifeste **par environnement** (`assets-dofus`, volume beta/prod) ;
 *  5. journalise chaque NEW / MODIFIED / REMOVED dans `GameDataChangeLog`.
 *
 * Ce qu'il ne fait **jamais** :
 *  · supprimer une classe ou un asset (une disparition = `retired` + journal) ;
 *  · exposer une classe bêta dans le bundle client (le code reste humain) ;
 *  · remplacer un snapshot prod par un snapshot bêta (la prod gagne toujours).
 */

import fs from "node:fs";
import path from "node:path";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { dofusdbFetch } from "@/lib/dofusdb-fetch";
import { logger } from "@/lib/logger";
import { recordGameDataChanges } from "@/lib/game-data-changelog";
import { siphonAndCompressImage } from "@/lib/dofus-asset-siphon";
import {
    buildClassCatalogManifest,
    diffClassCatalog,
    summarizeClassCatalogDiff,
    type ClassCatalogManifest,
} from "@/lib/class-catalog";

export const CLASS_CATALOG_PUBLIC_DIR = path.join(
    process.cwd(),
    "public",
    "uploads",
    "assets-dofus",
);
export const CLASS_CATALOG_PATH = path.join(CLASS_CATALOG_PUBLIC_DIR, "class-catalog.json");
export const CLASS_CATALOG_PUBLIC_URL = "/uploads/assets-dofus/class-catalog.json";

/** Grimoires dont le rafraîchissement n'a pas encore été mis en file (reprise cron). */
export const CLASS_SPELL_REFRESH_PENDING_PATH = path.join(
    CLASS_CATALOG_PUBLIC_DIR,
    "class-spell-refresh-pending.json",
);

export interface PendingClassSpellRefresh {
    classId: number;
    source: "prod" | "beta";
    reason: string;
    requestedAt: string;
}

export function readPendingClassSpellRefresh(): PendingClassSpellRefresh[] {
    try {
        if (!fs.existsSync(CLASS_SPELL_REFRESH_PENDING_PATH)) return [];
        const parsed = JSON.parse(fs.readFileSync(CLASS_SPELL_REFRESH_PENDING_PATH, "utf8"));
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (item): item is PendingClassSpellRefresh =>
                Number.isInteger(item?.classId)
                && (item?.source === "prod" || item?.source === "beta"),
        );
    } catch (error) {
        logger.warn("[class-catalog] lecture des grimoires en attente impossible", {
            error: String(error),
        });
        return [];
    }
}

export function writePendingClassSpellRefresh(items: readonly PendingClassSpellRefresh[]): void {
    fs.mkdirSync(CLASS_CATALOG_PUBLIC_DIR, { recursive: true });
    if (items.length === 0) {
        try {
            fs.rmSync(CLASS_SPELL_REFRESH_PENDING_PATH, { force: true });
        } catch {
            // Un fichier déjà absent n'est pas une erreur.
        }
        return;
    }
    const tmp = `${CLASS_SPELL_REFRESH_PENDING_PATH}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(items, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, CLASS_SPELL_REFRESH_PENDING_PATH);
}

/** Fusionne sans doublon (`source:classId`) ; l'entrée déjà en attente garde sa date. */
export function mergePendingClassSpellRefresh(
    previous: readonly PendingClassSpellRefresh[],
    next: readonly PendingClassSpellRefresh[],
): PendingClassSpellRefresh[] {
    const byKey = new Map<string, PendingClassSpellRefresh>();
    for (const item of [...previous, ...next]) {
        const key = `${item.source}:${item.classId}`;
        if (!byKey.has(key)) byKey.set(key, item);
    }
    return [...byKey.values()].sort((a, b) => a.classId - b.classId || a.source.localeCompare(b.source));
}

export interface ClassCatalogSyncResult {
    success: boolean;
    /** Le manifeste a-t-il été écrit ? */
    applied: boolean;
    prodTotal: number;
    betaTotal: number;
    changes: number;
    newLive: string[];
    newPreview: string[];
    modified: string[];
    removed: string[];
    missingFromCode: string[];
    codeMissingFromSources: string[];
    downloadedIcons: number;
    iconErrors: string[];
    /** Classes dont le grimoire doit être rafraîchi (Dofusbook id + source). */
    spellRefresh: Array<{ classId: number; source: "prod" | "beta" }>;
    summary: string;
    errors: string[];
}

function emptyResult(): ClassCatalogSyncResult {
    return {
        success: false,
        applied: false,
        prodTotal: 0,
        betaTotal: 0,
        changes: 0,
        newLive: [],
        newPreview: [],
        modified: [],
        removed: [],
        missingFromCode: [],
        codeMissingFromSources: [],
        downloadedIcons: 0,
        iconErrors: [],
        spellRefresh: [],
        summary: "Non exécuté",
        errors: [],
    };
}

/** Lit le manifeste local ; un fichier absent est un état normal (première passe). */
export function readClassCatalogManifest(): ClassCatalogManifest | null {
    try {
        if (!fs.existsSync(CLASS_CATALOG_PATH)) return null;
        const raw = fs.readFileSync(CLASS_CATALOG_PATH, "utf8");
        const parsed = JSON.parse(raw) as ClassCatalogManifest;
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.classes)) {
            logger.warn("[class-catalog] manifeste invalide, ignoré", { path: CLASS_CATALOG_PATH });
            return null;
        }
        return parsed;
    } catch (error) {
        logger.warn("[class-catalog] lecture du manifeste impossible", { error: String(error) });
        return null;
    }
}

/** Écriture atomique : un manifeste tronqué ne doit jamais remplacer le précédent. */
export function writeClassCatalogManifest(manifest: ClassCatalogManifest): void {
    fs.mkdirSync(CLASS_CATALOG_PUBLIC_DIR, { recursive: true });
    const tmp = `${CLASS_CATALOG_PATH}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, CLASS_CATALOG_PATH);
}

async function fetchBreeds(source: "prod" | "beta"): Promise<unknown[]> {
    const rows = await dofusdbFetch<unknown[]>("/breeds?$limit=50&lang=fr", { source });
    if (rows === null) throw new Error(`DofusDB ${source} injoignable`);
    return rows;
}

/**
 * Passe de veille. `apply: false` = dry-run (aucune écriture, aucun téléchargement).
 * La **prod** est obligatoire ; si elle échoue, on s'arrête sans toucher au manifeste
 * (une panne ne doit jamais ressembler à une suppression de classes).
 */
export async function syncClassCatalogCore(options: {
    apply?: boolean;
    downloadIcons?: boolean;
    now?: string;
} = {}): Promise<ClassCatalogSyncResult> {
    const apply = options.apply === true;
    const downloadIcons = options.downloadIcons !== false;
    const now = options.now ?? new Date().toISOString();
    const result = emptyResult();

    const previous = readClassCatalogManifest();

    let prodRows: unknown[];
    try {
        prodRows = await fetchBreeds("prod");
        if (prodRows.length === 0) throw new Error("DofusDB prod a renvoyé 0 classe");
    } catch (error) {
        result.errors.push(`Prod : ${error instanceof Error ? error.message : String(error)}`);
        result.summary = "Prod injoignable — manifeste inchangé";
        return result;
    }

    let betaRows: unknown[] | null = null;
    try {
        betaRows = await fetchBreeds("beta");
        if (betaRows.length === 0) throw new Error("DofusDB bêta a renvoyé 0 classe");
    } catch (error) {
        betaRows = null;
        result.errors.push(`Bêta indisponible : ${error instanceof Error ? error.message : String(error)}`);
        logger.warn("[class-catalog] bêta indisponible, poursuite sur la prod", { error: String(error) });
    }

    let manifest: ClassCatalogManifest;
    try {
        manifest = buildClassCatalogManifest({ previous, prodRows, betaRows, now });
    } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
        result.summary = "Manifeste non construit";
        return result;
    }

    const diff = diffClassCatalog(previous, manifest);
    result.prodTotal = manifest.prodTotal;
    result.betaTotal = manifest.betaTotal;
    result.changes = diff.changes.length;
    result.newLive = diff.newLive;
    result.newPreview = diff.newPreview;
    result.modified = diff.modified;
    result.removed = diff.removed;
    result.missingFromCode = diff.missingFromCode;
    result.codeMissingFromSources = manifest.codeMissingFromSources;

    // Grimoires : une classe du code dont le snapshot a changé (ou qui apparaît) est
    // re-siphonnée. Une preview lit la bêta ; une classe live lit la prod.
    const changedBreeds = new Set<number>([
        ...diff.changes
            .filter((change) => change.changeType !== "REMOVED")
            .map((change) => Number(change.entityId)),
    ]);
    if (!previous) {
        // Baseline : aucun diff, mais on rafraîchit au moins la classe preview du code.
        for (const cls of DOFUS_CLASSES) {
            if ("preview" in cls && cls.preview) changedBreeds.add(cls.breed);
        }
    }
    for (const breed of changedBreeds) {
        const entry = manifest.classes.find((c) => c.breed === breed);
        if (!entry?.codeDofusbookId) continue;
        result.spellRefresh.push({
            classId: entry.codeDofusbookId,
            source: entry.status === "preview" ? "beta" : "prod",
        });
    }

    if (apply) {
        if (downloadIcons) {
            for (const entry of manifest.classes) {
                // Les classes du code ont déjà une icône statique dans l'image.
                if (entry.inCode) continue;
                const remote = entry.prod?.iconUrl ?? entry.beta?.iconUrl;
                if (!remote) continue;
                const previousEntry = previous?.classes.find((c) => c.breed === entry.breed);
                const remoteChanged =
                    previousEntry?.prod?.iconUrl !== entry.prod?.iconUrl
                    || previousEntry?.beta?.iconUrl !== entry.beta?.iconUrl;
                const localPath = path.join(
                    process.cwd(),
                    "public",
                    ...entry.localIcon!.replace(/^\//, "").split("/"),
                );
                const force = remoteChanged || !fs.existsSync(localPath);
                const icon = await siphonAndCompressImage(remote, "classes", entry.breed, force, {
                    allowGuessedPath: false,
                });
                if (icon.success && icon.localUrl) {
                    entry.localIcon = icon.localUrl;
                    result.downloadedIcons++;
                } else {
                    result.iconErrors.push(`${entry.name} (#${entry.breed}) : ${icon.error ?? "échec"}`);
                }
            }
        }

        try {
            writeClassCatalogManifest(manifest);
            result.applied = true;
        } catch (error) {
            result.errors.push(`Écriture du manifeste : ${error instanceof Error ? error.message : String(error)}`);
        }

        // Reprise garantie : le cron peut être occupé (file CLASS_SPELLS déjà en cours).
        // On persiste les grimoires à rafraîchir ; le prochain passage les reprend même
        // si le diff est devenu vide.
        if (result.spellRefresh.length > 0) {
            try {
                const pending = mergePendingClassSpellRefresh(
                    readPendingClassSpellRefresh(),
                    result.spellRefresh.map((item) => ({
                        ...item,
                        reason: previous ? "snapshot de classe changé" : "baseline preview",
                        requestedAt: now,
                    })),
                );
                writePendingClassSpellRefresh(pending);
            } catch (error) {
                result.errors.push(
                    `Grimoires en attente : ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }

        if (diff.changes.length > 0) {
            try {
                await recordGameDataChanges(
                    "CLASSES",
                    diff.changes.map((change) => ({
                        entityType: "class",
                        entityId: change.entityId,
                        entityName: change.entityName,
                        changeType: change.changeType,
                        fields: change.fields,
                    })),
                );
            } catch (error) {
                result.errors.push(`Journal des changements : ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    result.success = result.errors.length === 0 || result.applied;
    result.summary = summarizeClassCatalogDiff(diff, manifest);
    if (result.iconErrors.length > 0) {
        result.summary += ` · ${result.iconErrors.length} icône(s) en échec`;
    }
    return result;
}
