/**
 * 🗂️ Journal des tâches CRON (lot C2) — règle **pure** + câblage.
 *
 * Source : Redis `cron:telemetry:history:<cronId>` (10 dernières exécutions par tâche,
 * TTL 7 jours), écrit par `recordCronExecution`. Ce test verrouille :
 *  ① l'agrégation (tri, doublons, entrées illisibles écartées, plafond 500) ;
 *  ② les filtres (tâche, statut, fenêtre, recherche) — une seule règle, côté serveur ;
 *  ③ l'affichage des détails (jamais `[object Object]`, plafond **dit**) ;
 *  ④ la sécurité de la route (session + `isSuperAdmin`) et son branchement dans
 *    `?tab=cron-status` (aucune page neuve, aucune règle dupliquée).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildCronJournal,
  cronJournalDetailRows,
  cronJournalFacets,
  filterCronJournal,
  groupCronJournalByDay,
  CRON_JOURNAL_MAX_DETAIL_ROWS,
  CRON_JOURNAL_MAX_ENTRIES,
  type CronJournalSource,
} from "@/lib/cron-journal";

const source = (cronId: string, name: string, records: unknown[]): CronJournalSource => ({
  cronId,
  name,
  schedule: "Quotidien 03h00",
  records,
});

const run = (iso: string, extra: Record<string, unknown> = {}) => ({
  id: "x",
  name: "Tâche",
  schedule: "Quotidien 03h00",
  lastRun: iso,
  durationMs: 1200,
  status: "success",
  summary: "Exécution réussie",
  details: {},
  lines: [],
  ...extra,
});

describe("agrégation — un journal unique, trié, sans doublon", () => {
  it("fusionne les tâches et trie du plus récent au plus ancien", () => {
    const entries = buildCronJournal([
      source("backup_db", "Backup BDD", [
        run("2026-10-18T03:00:00.000Z"),
        run("2026-10-17T03:00:00.000Z"),
      ]),
      source("sync_members", "Sync Membres", [
        run("2026-10-18T04:00:00.000Z", { status: "error", summary: "échec" }),
      ]),
    ]);

    expect(entries.map((entry) => entry.lastRun)).toEqual([
      "2026-10-18T04:00:00.000Z",
      "2026-10-18T03:00:00.000Z",
      "2026-10-17T03:00:00.000Z",
    ]);
    expect(entries[0].cronId).toBe("sync_members");
    expect(entries[0].status).toBe("error");
  });

  it("écarte les entrées illisibles sans vider le journal", () => {
    const entries = buildCronJournal([
      source("backup_db", "Backup BDD", [
        null,
        "pas-un-objet",
        {},
        { lastRun: "pas-une-date" },
        { lastRun: 123 },
        run("2026-10-18T03:00:00.000Z"),
      ]),
    ]);
    expect(entries).toHaveLength(1);
  });

  it("déduplique (même tâche + même date) et retombe sur le nom de la tâche", () => {
    const entries = buildCronJournal([
      source("backup_db", "Backup BDD", [
        run("2026-10-18T03:00:00.000Z", { name: "" }),
        run("2026-10-18T03:00:00.000Z", { name: "" }),
      ]),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Backup BDD");
  });

  it("plafonne à 500 lignes (protection mémoire de l'écran)", () => {
    const records = Array.from({ length: 520 }, (_, index) =>
      run(new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString()),
    );
    expect(buildCronJournal([source("backup_db", "Backup BDD", records)])).toHaveLength(
      CRON_JOURNAL_MAX_ENTRIES,
    );
  });
});

describe("filtres — une seule règle, côté serveur", () => {
  const now = Date.parse("2026-10-18T12:00:00.000Z");
  const entries = buildCronJournal([
    source("backup_db", "Backup BDD", [
      run("2026-10-18T03:00:00.000Z", { summary: "Sauvegarde GPG → R2 OK" }),
      run("2026-10-16T03:00:00.000Z", { status: "error", summary: "Sauvegarde échouée" }),
    ]),
    source("ladder_sync", "Ladder Sync", [
      run("2026-10-18T05:00:00.000Z", {
        summary: "Synchronisation ladder : 12/12",
        details: { failCount: 0, successes: 12 },
      }),
    ]),
  ]);

  it("filtre par tâche et par statut", () => {
    expect(filterCronJournal(entries, { taskId: "backup_db", status: "all" }, now)).toHaveLength(2);
    expect(filterCronJournal(entries, { taskId: "all", status: "error" }, now)).toHaveLength(1);
    expect(filterCronJournal(entries, { taskId: "inconnue", status: "all" }, now)).toHaveLength(0);
  });

  it("filtre par fenêtre (24 h) sans toucher au reste", () => {
    const last24h = filterCronJournal(entries, { taskId: "all", period: "24h" }, now);
    expect(last24h.map((entry) => entry.cronId)).toEqual(["ladder_sync", "backup_db"]);
    expect(filterCronJournal(entries, { taskId: "all", period: "all" }, now)).toHaveLength(3);
  });

  it("cherche dans le résumé ET dans les détails", () => {
    expect(filterCronJournal(entries, { search: "gpg" }, now)).toHaveLength(1);
    expect(filterCronJournal(entries, { search: "failcount" }, now)).toHaveLength(1);
    expect(filterCronJournal(entries, { search: "introuvable" }, now)).toHaveLength(0);
  });

  it("compte les facettes sur le journal non filtré", () => {
    const facets = cronJournalFacets(entries);
    expect(facets.total).toBe(3);
    expect(facets.success).toBe(2);
    expect(facets.error).toBe(1);
    expect(facets.tasks.map((task) => [task.cronId, task.count])).toEqual([
      ["backup_db", 2],
      ["ladder_sync", 1],
    ]);
  });
});

describe("affichage — jours UTC et détails lisibles", () => {
  it("regroupe par jour UTC, sans réordonner", () => {
    const entries = buildCronJournal([
      source("backup_db", "Backup BDD", [
        run("2026-10-18T03:00:00.000Z"),
        run("2026-10-17T23:00:00.000Z"),
      ]),
    ]);
    const days = groupCronJournalByDay(entries);
    expect(days.map((day) => day.day)).toEqual(["2026-10-18", "2026-10-17"]);
    expect(days[0].entries).toHaveLength(1);
  });

  it("rend les valeurs sans « [object Object] » et retire les vides", () => {
    const { rows, hidden } = cronJournalDetailRows({
      liste: ["a", "b"],
      objet: { x: 1 },
      vide: null,
      texte: "ok",
    });
    expect(rows).toEqual([
      { label: "liste", value: "a, b" },
      { label: "objet", value: '{"x":1}' },
      { label: "texte", value: "ok" },
    ]);
    expect(hidden).toBe(0);
  });

  it("plafonne l'affichage des détails en DISANT combien manquent", () => {
    const details = Object.fromEntries(
      Array.from({ length: CRON_JOURNAL_MAX_DETAIL_ROWS + 1 }, (_, index) => [`c${index}`, index]),
    );
    const { rows, hidden } = cronJournalDetailRows(details);
    expect(rows).toHaveLength(CRON_JOURNAL_MAX_DETAIL_ROWS);
    expect(hidden).toBe(1);
  });
});

describe("câblage — sécurité, branchement, pas de règle dupliquée", () => {
  const route = readFileSync("src/app/api/god/task-journal/route.ts", "utf8");
  const page = readFileSync("src/app/god/page.tsx", "utf8");
  const panel = readFileSync("src/app/god/components/task-journal-panel.tsx", "utf8");
  const tabs = readFileSync("src/app/god/components/cron-status-tabs.tsx", "utf8");
  const telemetry = readFileSync("src/lib/cron-telemetry.ts", "utf8");

  it("la route exige une session ET le statut super-admin (fail-closed)", () => {
    expect(route).toMatch(/await auth\(\)/);
    expect(route).toMatch(/session\?\.user\?\.id/);
    expect(route).toMatch(/isSuperAdmin\(\)/);
    expect(route).toMatch(/status:\s*401/);
    expect(route).toMatch(/status:\s*403/);
  });

  it("la route délègue le filtrage à la règle pure (aucun filtre maison)", () => {
    expect(route).toMatch(/filterCronJournal\(/);
    expect(route).not.toMatch(/entries\.filter\(/);
    expect(route).toMatch(/safeParse\(/);
  });

  it("le journal est un onglet de `?tab=cron-status`, pas une page neuve", () => {
    expect(page).toMatch(/<CronStatusTabs \/>/);
    expect(page).not.toMatch(/<CronStatusPanel \/>/);
    expect(tabs).toMatch(/<CronStatusPanel \/>/);
    expect(tabs).toMatch(/<TaskJournalPanel \/>/);
  });

  it("le panneau affiche TOUTES les entrées reçues et dit quand Redis est muet", () => {
    expect(panel).toMatch(/data\.entries/);
    expect(panel).not.toMatch(/entries\.slice\(\s*0\s*,\s*\d/);
    expect(panel).toMatch(/redisOk/);
    expect(panel).toMatch(/Redis indisponible/);
  });

  it("la borne d'historique est une constante unique (écriture ET lecture)", () => {
    expect(telemetry).toMatch(/export const CRON_HISTORY_LIMIT = 10/);
    expect(telemetry.match(/CRON_HISTORY_LIMIT - 1/g)?.length).toBeGreaterThanOrEqual(3);
    expect(telemetry).not.toMatch(/ltrim\(historyKey, 0, 9\)/);
    expect(telemetry).not.toMatch(/lrange\(historyKey, 0, 9\)/);
  });
});
