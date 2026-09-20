/**
 * Réparation (non commitée) : annule un double encodage UTF-8 → cp1252 → UTF-8.
 * Ne touche QUE les séquences qui sont un UTF-8 valide caché dans des chars cp1252.
 *   node src/temp/refonte_landing/fix-mojibake.mjs [fichier] [--write]
 * Sans `--write` : rapport seul (aucune écriture).
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";

const file = process.argv[2] || "src/app/globals.css";
const write = process.argv.includes("--write");

// Table inverse cp1252 (octet → char) puis char → octet.
const CP1252_HIGH = {
    0x80: "\u20ac", 0x82: "\u201a", 0x83: "\u0192", 0x84: "\u201e", 0x85: "\u2026",
    0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02c6", 0x89: "\u2030", 0x8a: "\u0160",
    0x8b: "\u2039", 0x8c: "\u0152", 0x8e: "\u017d", 0x91: "\u2018", 0x92: "\u2019",
    0x93: "\u201c", 0x94: "\u201d", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
    0x98: "\u02dc", 0x99: "\u2122", 0x9a: "\u0161", 0x9b: "\u203a", 0x9c: "\u0153",
    0x9e: "\u017e", 0x9f: "\u0178",
};
const TO_BYTE = new Map();
for (let b = 0xa0; b <= 0xff; b++) TO_BYTE.set(String.fromCharCode(b), b);
// Caractères de contrôle C1 : Windows-1252 laisse passer ces octets (maps 1:1),
// ils sont donc INVISIBLES dans un fichier double-encodé — il faut les inclure.
for (const b of [0x81, 0x8d, 0x8f, 0x90, 0x9d]) TO_BYTE.set(String.fromCharCode(b), b);
for (const [b, ch] of Object.entries(CP1252_HIGH)) TO_BYTE.set(ch, Number(b));

const byteOf = (ch) => TO_BYTE.get(ch);
const isLead = (ch) => {
    const b = byteOf(ch);
    return b !== undefined && b >= 0xc2 && b <= 0xf4;
};
const isCont = (ch) => {
    const b = byteOf(ch);
    return b !== undefined && b >= 0x80 && b <= 0xbf;
};

const original = readFileSync(file, "utf8");
const eol = original.includes("\r\n") ? "\r\n" : "\n";
let out = "";
let repaired = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < original.length; ) {
    const ch = original[i];
    if (!isLead(ch)) {
        out += ch;
        i++;
        continue;
    }
    // Longueur attendue par l'octet de tête UTF-8.
    const lead = byteOf(ch);
    const expect = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : 2;
    let run = ch;
    let j = i + 1;
    while (j < original.length && run.length < expect && isCont(original[j])) {
        run += original[j];
        j++;
    }
    if (run.length < 2) {
        out += ch;
        i++;
        continue;
    }
    const bytes = Buffer.from(Array.from(run).map((c) => byteOf(c)));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const clean = !decoded.includes("\ufffd") && decoded.length >= 1;
    if (clean) {
        out += decoded;
        repaired++;
    } else {
        out += run;
        failed++;
        failures.push(run);
    }
    i = j;
}

console.log(`fichier   : ${file}`);
console.log(`runs réparés : ${repaired} · runs laissés (décodage impossible) : ${failed}`);
if (failures.length) console.log(`  restants : ${failures.slice(0, 10).join(" ")}`);
const before = original.length;
const after = out.length;
console.log(`taille    : ${before} → ${after} chars`);
const shares = ["↗", "─", "é", "—", "’", "→", "−", "«", "»", "œ"];
console.log(`échantillon après réparation : ${shares.map((c) => `${c}=${(out.split(c).length - 1)}`).join(" · ")}`);
const bad = /[\u00c2-\u00c3\u00c5\u00c6][\u0080-\u00bf\u2013-\u2122\u0152-\u017e\u02c6\u2030\u2039\u203a\u20ac]|\u00e2[\u0080-\u00bf][\u0080-\u00bf\u2013-\u2122\u0152-\u017e\u02c6\u2030\u2039\u203a\u20ac]/g;
console.log(`mojibake restant (motif simple) : ${(out.match(bad) || []).length}`);

if (!write) {
    console.log("(rapport seul — ajouter --write pour écrire le fichier)");
} else {
    const backup = `${file}.mojibake-backup`;
    if (!existsSync(backup)) copyFileSync(file, backup);
    writeFileSync(file, out.replace(/\r?\n/g, eol), "utf8");
    console.log(`écrit ✔ (sauvegarde : ${backup})`);
}
