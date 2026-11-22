#!/usr/bin/env node
/**
 * Liens locaux du harnais : rend les skills lisibles par Codex/Claude sans dupliquer.
 * Source unique : .cline/skills. Les liens sont gitignorés et recréés par `npm run harness:links`.
 */
import { lstatSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, ".cline", "skills");
const sourceStat = lstatSync(source, { throwIfNoEntry: false });
if (!sourceStat?.isDirectory()) {
    console.error("Source introuvable : .cline/skills");
    process.exit(1);
}

const links = [
    { path: path.join(root, ".agents", "skills"), label: ".agents/skills" },
    { path: path.join(root, ".claude", "skills"), label: ".claude/skills" },
];

let created = 0;
let skipped = 0;
for (const { path: target, label } of links) {
    const existing = lstatSync(target, { throwIfNoEntry: false });
    if (existing) {
        console.log(`${existing.isSymbolicLink() ? "=" : "!"} ${label} : ${existing.isSymbolicLink() ? "déjà lié" : "existe et n'est pas un lien, ignoré"}`);
        skipped++;
        continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    symlinkSync(source, target, process.platform === "win32" ? "junction" : "dir");
    console.log(`+ ${label} -> .cline/skills`);
    created++;
}
console.log(`Liens du harnais : ${created} créé(s), ${skipped} ignoré(s).`);
