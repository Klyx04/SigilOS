import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Next interdit d'exporter une **valeur** non-fonction depuis un fichier
 * `"use server"` : le build échoue (`A "use server" file can only export async
 * functions, found object`). Mesuré le 20/11/2026 sur
 * `src/server/actions/optimized-guide-actions.ts` : un schéma Zod exporté a
 * cassé la collecte de `/guides/rush-sylvestre` alors que `tsc` et les tests
 * étaient verts. Ce verrou balaie les actions pour que le piège ne revienne pas.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Un fichier est `"use server"` quand la directive est dans ses premières lignes. */
function isUseServer(source: string): boolean {
  return source
    .split("\n")
    .slice(0, 5)
    .some((line) => /^\s*["']use server["']\s*;?\s*$/.test(line));
}

/** Retire les commentaires de ligne pour ne pas confondre un exemple et du code. */
function stripLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * Next accepte une **fonction** (y compris `cache(fn)`, qui en retourne une) ;
 * il refuse un **objet** (schéma Zod, constante, Map…). On lit donc la première
 * ligne de l'expression pour trier : `cache(`, `async`, `function` ou `=>` = fonction.
 */
const VALUE_EXPORT = /^\s*export\s+(class|enum|const|let|var)\s+([A-Za-z0-9_$]+)\s*(?:=\s*(.*))?$/gm;

function forbiddenExports(source: string): string[] {
  const code = stripLineComments(source);
  const out: string[] = [];
  for (const match of code.matchAll(VALUE_EXPORT)) {
    const [, kind, name, value] = match;
    if (kind === "class" || kind === "enum") {
      out.push(name);
      continue;
    }
    const expression = (value ?? "").trim();
    if (/^(cache\s*\(|async\b|function\b)/.test(expression) || expression.includes("=>")) continue;
    out.push(name);
  }
  return out;
}

const FILES = [
  ...walk(path.join(process.cwd(), "src", "server")),
  ...walk(path.join(process.cwd(), "src", "app")),
];

describe('use server — exports autorisés', () => {
  it('aucun fichier "use server" n\'exporte de valeur (const, let, class, enum)', () => {
    const offenders = FILES.filter((file) => {
      const source = readFileSync(file, "utf8");
      if (!isUseServer(source)) return false;
      return forbiddenExports(source).length > 0;
    }).map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it("le verrou voit bien les fichiers d'actions (garde anti-test-vide)", () => {
    const useServerFiles = FILES.filter((file) => isUseServer(readFileSync(file, "utf8")));
    expect(useServerFiles.length).toBeGreaterThan(0);
  });
});
