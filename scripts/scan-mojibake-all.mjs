/**
 * Balayage (non commité) : reste-t-il du mojibake ailleurs que dans globals.css ?
 * Même règle que le réparateur : un octet de tête UTF-8 caché dans un char cp1252
 * suivi d'octets de continuation.
 *   node src/temp/refonte_landing/scan-mojibake-all.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

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
// Contrôles C1 : ceux que Windows-1252 transmet tels quels (donc invisibles).
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

/** Compte les séquences réparables (et donne un aperçu de la première). */
function detect(text) {
    let runs = 0;
    let preview = "";
    for (let i = 0; i < text.length; ) {
        if (!isLead(text[i])) {
            i++;
            continue;
        }
        const lead = byteOf(text[i]);
        const expect = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : 2;
        let run = text[i];
        let j = i + 1;
        while (j < text.length && run.length < expect && isCont(text[j])) {
            run += text[j];
            j++;
        }
        if (run.length >= 2) {
            const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
                Buffer.from(Array.from(run).map((c) => byteOf(c)))
            );
            if (!decoded.includes("\ufffd")) {
                runs++;
                if (!preview) preview = `${run} → ${decoded}`;
            }
        }
        i = j;
    }
    return { runs, preview };
}

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "temp", "archive"]);
const SKIP_FILES = /^(probe-|fix-|verify-|scan-)/;
const results = [];
const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = path.join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            walk(full);
            continue;
        }
        if (!/\.(tsx?|jsx?|mjs|cjs|css|scss|md|mdx|json|txt|html|yml|yaml|sql|prisma|svg|xml|csv|env|example)$/i.test(entry)) continue;
        if (SKIP_FILES.test(entry)) continue;
        if (st.size > 32 * 1024 * 1024) continue;
        const { runs, preview } = detect(readFileSync(full, "utf8"));
        if (runs) results.push({ full, runs, preview });
    }
};
for (const root of ["src", "public", "tests", "scripts", "docs", "prisma", ".agents", ".github"]) {
    try {
        walk(root);
    } catch {
        /* dossier absent */
    }
}
results.sort((a, b) => b.runs - a.runs);
for (const r of results) console.log(`  ${r.runs.toString().padStart(5)}  ${r.full}   ${r.preview}`);
console.log(`fichiers avec mojibake : ${results.length}`);
