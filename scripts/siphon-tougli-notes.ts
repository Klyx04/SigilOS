#!/usr/bin/env tsx
/**
 * Siphon des **notes Tougli** (guide RSA) — données brutes normalisées, zone volatile.
 *
 * Mesure du 03/11/2026 : Tougli ne met **aucun texte** dans `quests[].objectives` (0/1 085) ;
 * ses notes sont de deux sortes :
 *   ① les **textes du guide** (73 objectifs `payload.text.fr` — notes globales et `take_quests`
 *      avec références `&n`) ;
 *   ② les **contraintes de quête** structurées : `needPlayer` (38), `job` (37), `hours` (6),
 *      `spell` (3), `note` (4) — absentes de notre base (nos tags s'arrêtent à
 *      `plusieurs_personnes`).
 *
 * Sortie : `src/temp/archive/siphon-align/tougli-notes.json` — **zone volatile**, jamais
 * committée (même règle que le siphon Dofusyelle).
 *
 * Usage : `npx tsx scripts/siphon-tougli-notes.ts [--source <fichier>] [--api]`
 */
process.env.NODE_ENV ||= "development";

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { resolveQuestRefs } from "../src/lib/rush-quest-refs";

const SLUG = "rsa-rush-sylvestre-accelere";
const API = `https://api.tougli.barbofus.com/api/guide/details-batch?slugs=${SLUG}`;
const DEFAULT_SOURCE = "src/temp/archive/siphon-align/tougli-guide-details.json";
const OUT_FILE = "src/temp/archive/siphon-align/tougli-notes.json";

/** Types de contraintes qu'on extrait (les autres sont des données de combat/donjon). */
const CONSTRAINT_TYPES = new Set(["job", "needPlayer", "hours", "spell", "note"]);

const argv = process.argv.slice(2);
const valueOf = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

type TextPayload = string | { fr?: string; detail?: string } | null | undefined;

/** Texte lisible d'une contrainte — jamais de JSON brut dans le guide. */
function constraintText(type: string, payload: TextPayload): string {
  if (typeof payload === "string") return payload.trim();
  if (payload && typeof payload === "object") {
    if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail.trim();
    if (typeof payload.fr === "string" && payload.fr.trim()) return payload.fr.trim();
  }
  return "";
}

async function loadTougli(): Promise<unknown> {
  if (argv.includes("--api")) {
    const response = await fetch(API);
    if (!response.ok) throw new Error(`Tougli a répondu ${response.status} — arrêt (fail-closed)`);
    return response.json();
  }
  const file = path.resolve(valueOf("--source", DEFAULT_SOURCE));
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`source Tougli introuvable (${file}) — relancer avec --api ou --source <fichier>`);
  }
}

async function main(): Promise<void> {
  const tougli = (await loadTougli()) as {
    data?: Record<string, {
      guide?: { objectives?: Array<{ type?: string; payload?: { text?: { fr?: string }; quests?: number[] } }> };
      quests?: Record<string, { name?: { fr?: string }; objectives?: Array<{ type?: string; payload?: TextPayload }> }>;
    }>;
  };
  const root = tougli.data?.[SLUG];
  if (!root) throw new Error("structure Tougli inattendue — arrêt (fail-closed)");
  const quests = root.quests ?? {};

  // ─── ① Textes du guide (notes globales + take_quests), références résolues ──
  const guideNotes: Array<{ type: string; text: string; questIds: number[]; questNames: string[] }> = [];
  for (const objective of root.guide?.objectives ?? []) {
    const raw = objective?.payload?.text?.fr;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const ids = Array.isArray(objective.payload?.quests) ? objective.payload.quests : [];
    const names = new Map<number, string>();
    ids.forEach((id, index) => {
      const name = quests[String(id)]?.name?.fr;
      if (typeof name === "string" && name.trim()) names.set(index + 1, name.trim());
    });
    guideNotes.push({
      type: String(objective.type ?? "note"),
      text: resolveQuestRefs(raw, names),
      questIds: ids,
      questNames: ids.map((id) => quests[String(id)]?.name?.fr ?? "").filter(Boolean),
    });
  }

  // ─── ② Contraintes de quête (métier, joueurs, horaire, sort, note) ─────────
  const questConstraints: Array<{ questId: number; questName: string; constraints: Array<{ type: string; text: string }> }> = [];
  for (const [id, quest] of Object.entries(quests)) {
    const constraints: Array<{ type: string; text: string }> = [];
    for (const objective of quest?.objectives ?? []) {
      const type = String(objective?.type ?? "");
      if (!CONSTRAINT_TYPES.has(type)) continue;
      const text = constraintText(type, objective.payload);
      if (text) constraints.push({ type, text });
    }
    if (constraints.length) {
      questConstraints.push({
        questId: Number(id),
        questName: quest?.name?.fr ?? "",
        constraints,
      });
    }
  }

  const out = {
    meta: {
      source: argv.includes("--api") ? API : valueOf("--source", DEFAULT_SOURCE),
      slug: SLUG,
      generatedAt: new Date().toISOString(),
      guideNotes: guideNotes.length,
      questsWithConstraints: questConstraints.length,
    },
    guideNotes,
    questConstraints,
  };
  const outPath = path.resolve(OUT_FILE);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(`sortie    : ${path.relative(process.cwd(), outPath)}`);
  console.log(`notes guide = ${guideNotes.length} · quêtes contraintes = ${questConstraints.length}`);
  const byType = questConstraints.flatMap((q) => q.constraints).reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`contraintes : ${Object.entries(byType).map(([type, n]) => `${type}=${n}`).join(" · ")}`);
}

main().catch((error) => {
  console.error("[tougli-notes] échec :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
