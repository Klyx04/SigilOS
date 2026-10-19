#!/usr/bin/env node
/**
 * Contrôle des scripts d'installation npm (chaîne d'approvisionnement).
 *
 * Pourquoi : TensorLake (2026-10-08) et MALFEX (`tlxbnhd`, retiré le
 * 2026-09-22) n'exploitent pas une faille du code applicatif : ils exécutent
 * du code au moment de `npm install` / `npm ci`, via `preinstall`, `install`
 * ou `postinstall`. Le lockfile fige la version, pas le comportement du
 * mainteneur : un paquet sain aujourd'hui peut être piégé demain.
 *
 * Règle : tout paquet du lock qui déclare `hasInstallScript` doit figurer dans
 * l'allowlist ci-dessous, avec la raison écrite. Un nouveau venu fait échouer
 * la CI : on l'examine, puis on l'ajoute (ou on le retire).
 *
 * Usage : node scripts/check-install-scripts.mjs [--lock package-lock.json]
 * Lecture seule, zéro dépendance, aucun `npm ci` requis.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Allowlist explicite (clé = nom du paquet, sans `node_modules/`).
 * Chaque entrée dit CE QUE FAIT le script, pas seulement « c'est connu ».
 * Mise à jour : même commit que l'ajout de la dépendance, avec justification.
 */
export const ALLOWED_INSTALL_SCRIPTS = new Map([
    ["@prisma/engines", "télécharge le moteur de schéma Prisma (binaire local)"],
    ["@sentry/cli", "télécharge le binaire d'envoi des source maps"],
    ["core-js", "affiche un message de financement — aucun code exécuté"],
    ["esbuild", "vérifie le binaire fourni par une optionalDependency"],
    ["fsevents", "macOS uniquement (non installé sous Linux/Windows)"],
    ["msgpackr-extract", "compile un accélérateur natif optionnel (repli JS)"],
    ["prisma", "préinstall : contrôle de version Node/npm"],
    ["unrs-resolver", "installe le binaire natif du résolveur ESLint"],
]);

/**
 * Extrait `nom` ou `@scope/nom` d'une clé de lock (`node_modules/...`,
 * y compris les chemins imbriqués `node_modules/a/node_modules/b`).
 */
export function packageNameFromLockKey(key) {
    const marker = "node_modules/";
    const index = key.lastIndexOf(marker);
    if (index === -1) return null;
    const name = key.slice(index + marker.length);
    return name.length > 0 ? name : null;
}

/** Retourne les paquets à script d'installation absents de l'allowlist. */
export function findUnexpectedInstallScripts(lock, allowed = ALLOWED_INSTALL_SCRIPTS) {
    const packages = lock?.packages ?? {};
    const unexpected = [];
    for (const [key, meta] of Object.entries(packages)) {
        if (meta?.hasInstallScript !== true) continue;
        const name = packageNameFromLockKey(key);
        if (!name) continue;
        if (!allowed.has(name)) {
            unexpected.push({ path: key, name, version: meta.version ?? "?" });
        }
    }
    return unexpected.sort((a, b) => a.name.localeCompare(b.name));
}

/** Nombre total de paquets qui déclarent un script d'installation. */
export function countInstallScripts(lock) {
    return Object.values(lock?.packages ?? {}).filter((meta) => meta?.hasInstallScript === true)
        .length;
}

function main(argv) {
    const lockIndex = argv.indexOf("--lock");
    const lockPath = lockIndex !== -1 ? argv[lockIndex + 1] : "package-lock.json";

    if (lockIndex !== -1 && !lockPath) {
        console.error("❌ --lock attend un chemin de fichier.");
        process.exit(1);
    }

    let lock;
    try {
        lock = JSON.parse(readFileSync(path.resolve(lockPath), "utf8"));
    } catch (error) {
        console.error(`❌ Lockfile illisible (${lockPath}) : ${error.message}`);
        process.exit(1);
    }

    const unexpected = findUnexpectedInstallScripts(lock);
    if (unexpected.length > 0) {
        console.error("❌ Paquet(s) avec script d'installation hors allowlist :");
        for (const pkg of unexpected) {
            console.error(`   - ${pkg.name}@${pkg.version} (${pkg.path})`);
        }
        console.error("");
        console.error("   Un `preinstall` / `install` / `postinstall` exécute du code à");
        console.error("   l'installation : c'est le vecteur de TensorLake (2026-10) et MALFEX.");
        console.error("   Examiner le paquet, puis l'ajouter à ALLOWED_INSTALL_SCRIPTS avec");
        console.error("   sa raison, ou le retirer — scripts/check-install-scripts.mjs.");
        process.exit(1);
    }

    console.log(
        `✅ ${countInstallScripts(lock)} paquet(s) à script d'installation, tous justifiés dans l'allowlist.`,
    );
}

// Exécution directe uniquement : le test unitaire importe les fonctions pures.
const invokedDirectly =
    process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) main(process.argv.slice(2));
