#!/usr/bin/env node
/**
 * Liens locaux du harnais : rendent les skills lisibles par Claude Code sans dupliquer.
 * Source unique versionnée : `.agents/skills`. Les liens sont gitignorés et recréés par
 * `npm run harness:links` ; `--check` vérifie sans rien modifier.
 *
 * Règles : jamais de remplacement d'un dossier réel (sauf s'il est vide), jamais de
 * duplication de contenu. Un lien cassé est recréé ; un lien qui pointe ailleurs est
 * signalé et laisse en place.
 */
import { lstatSync, mkdirSync, readdirSync, realpathSync, rmdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HARNESS_LINKS_ROOT
    ? path.resolve(process.env.HARNESS_LINKS_ROOT)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, ".agents", "skills");
const checkOnly = process.argv.includes("--check");

const fail = (message) => {
    console.error(`✗ ${message}`);
    process.exit(1);
};

const sourceStat = lstatSync(source, { throwIfNoEntry: false });
if (!sourceStat?.isDirectory() || sourceStat.isSymbolicLink()) {
    fail("source introuvable ou liée : .agents/skills doit être un vrai dossier versionné");
}
const skills = readdirSync(source, { withFileTypes: true }).filter((entry) => entry.isDirectory());
if (skills.length === 0) fail("aucun skill dans .agents/skills");

const sourceReal = realpathSync(source);

const links = [{ path: path.join(root, ".claude", "skills"), label: ".claude/skills" }];

let created = 0;
let ok = 0;
let broken = 0;

for (const { path: target, label } of links) {
    const existing = lstatSync(target, { throwIfNoEntry: false });

    if (existing?.isSymbolicLink()) {
        let actual = null;
        try {
            actual = realpathSync(target);
        } catch {
            actual = null;
        }
        if (actual === sourceReal) {
            console.log(`= ${label} : déjà lié`);
            ok++;
            continue;
        }
        if (checkOnly || actual !== null) {
            console.warn(`! ${label} pointe vers ${actual ?? "une cible absente"} : ignoré`);
            broken++;
            continue;
        }
        rmSync(target, { force: true });
        console.log(`~ ${label} : lien cassé, recréé`);
    } else if (existing) {
        if (!checkOnly && existing.isDirectory() && readdirSync(target).length === 0) {
            rmdirSync(target);
            console.log(`~ ${label} : dossier vide remplacé par un lien`);
        } else {
            console.warn(`! ${label} existe et n'est pas un lien : ignoré`);
            broken++;
            continue;
        }
    }

    if (checkOnly) {
        console.warn(`! ${label} : lien absent`);
        broken++;
        continue;
    }

    mkdirSync(path.dirname(target), { recursive: true });
    const type = process.platform === "win32" ? "junction" : "dir";
    // Unix : cible relative, le lien survit à un déplacement du dépôt. Windows : jonction absolue.
    const linkTarget = type === "junction" ? source : path.relative(path.dirname(target), source);
    symlinkSync(linkTarget, target, type);
    console.log(`+ ${label} -> .agents/skills`);
    created++;
}

if (checkOnly) {
    if (broken > 0) fail(`${broken} lien(s) absent(s) ou incorrect(s)`);
    console.log(`Liens du harnais conformes : ${ok}/${links.length} (${skills.length} skills).`);
    process.exit(0);
}

if (broken > 0) fail(`${broken} cible(s) non remplacée(s) — corriger à la main`);
console.log(
    `Liens du harnais : ${created} créé(s), ${ok} déjà en place (${skills.length} skills).`,
);
