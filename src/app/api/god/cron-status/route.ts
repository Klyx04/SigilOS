import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import fs from "node:fs";
import path from "node:path";

/**
 * GET /api/god/cron-status
 * Lit les fichiers de log VPS pour chaque tâche cron connue et retourne
 * la dernière exécution, son statut (succès / erreur) et les dernières lignes.
 * Sécurisé : super-admin uniquement.
 */

const LOG_DIR = "/home/sigiladmin/SigilOS/logs";

// Source de vérité : correspondance entre les tâches cron du crontab VPS et leurs logs
const CRON_TASKS = [
  {
    id: "backup_db",
    name: "Backup BDD (GPG → R2)",
    schedule: "Quotidien 03h00",
    logFile: "backup.log",
    successPattern: /✅|success|ok|backup.*done|upload.*done/i,
    errorPattern: /error|fail|FAILED|❌/i,
  },
  {
    id: "maintenance",
    name: "Maintenance VPS",
    schedule: "Quotidien 04h00",
    logFile: "maintenance.log",
    successPattern: /✨|purifié|Maintenance Réussie|ALL CHECKS PASSED/i,
    errorPattern: /error|fail|FAILED|❌|Alerte.*disque/i,
  },
  {
    id: "cleanup_logs",
    name: "Purge Logs d'Audit",
    schedule: "Quotidien 03h05",
    logFile: "cleanup-logs.log",
    successPattern: /200|success|deleted|ok/i,
    errorPattern: /error|fail|[45]\d\d/i,
  },
  {
    id: "account_retention",
    name: "Purge RGPD Comptes Orphelins",
    schedule: "Quotidien 06h00",
    logFile: "account-retention.log",
    successPattern: /200|success|purged|ok/i,
    errorPattern: /error|fail|[45]\d\d/i,
  },
  {
    id: "sync_members",
    name: "Sync Membres Discord",
    schedule: "Toutes les 30 min",
    logFile: "sync-members.log",
    successPattern: /200|success|archived|ok/i,
    errorPattern: /error|fail|[45]\d\d/i,
  },
  {
    id: "avatar_resync",
    name: "Resync Avatars Discord",
    schedule: "Quotidien 05h00",
    logFile: "avatar-resync.log",
    successPattern: /200|success|synced|ok/i,
    errorPattern: /error|fail|[45]\d\d/i,
  },
  {
    id: "mission_reset",
    name: "Rappel Reset Missions",
    schedule: "Mardi 08h00",
    logFile: "missions_cron.log",
    successPattern: /200|success|sent|ok/i,
    errorPattern: /error|fail|[45]\d\d/i,
  },
  {
    id: "daily_summary",
    name: "Rapport Quotidien Guilde",
    schedule: "Quotidien 08h30",
    logFile: "daily_report.log",
    successPattern: /200|success|sent|ok/i,
    errorPattern: /error|fail|[45]\d\d/i,
  },
  {
    id: "discord_status",
    name: "Statut Discord",
    schedule: "Quotidien 09h00",
    logFile: "discord-status.log",
    successPattern: /200|success|ok/i,
    errorPattern: /error|fail|[45]\d\d/i,
  },
  {
    id: "janitor",
    name: "Janitor BDD (RGPD)",
    schedule: "Dans maintenance 04h00",
    logFile: "janitor.log",
    successPattern: /✅|done|completed|rows deleted/i,
    errorPattern: /error|fail|❌/i,
  },
] as const;

function readLastLines(filePath: string, n = 30): string[] {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-n);
  } catch {
    return [];
  }
}

function getFileStats(filePath: string): { mtime: Date | null; sizeBytes: number } {
  try {
    const stat = fs.statSync(filePath);
    return { mtime: stat.mtime, sizeBytes: stat.size };
  } catch {
    return { mtime: null, sizeBytes: 0 };
  }
}

function detectStatus(
  lines: string[],
  successPattern: RegExp,
  errorPattern: RegExp
): "success" | "error" | "unknown" {
  const lastLines = lines.slice(-10).join("\n");
  if (errorPattern.test(lastLines)) return "error";
  if (successPattern.test(lastLines)) return "success";
  return "unknown";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = CRON_TASKS.map((task) => {
    const logPath = path.join(LOG_DIR, task.logFile);
    const { mtime, sizeBytes } = getFileStats(logPath);
    const lastLines = readLastLines(logPath, 30);
    const status = lastLines.length > 0
      ? detectStatus(lastLines, task.successPattern, task.errorPattern)
      : "unknown";

    return {
      id: task.id,
      name: task.name,
      schedule: task.schedule,
      logFile: task.logFile,
      lastRun: mtime ? mtime.toISOString() : null,
      sizeBytes,
      status,
      lastLines: lastLines.slice(-10), // 10 dernières lignes pour le détail
    };
  });

  // Résumé global
  const errorCount = results.filter((r) => r.status === "error").length;
  const successCount = results.filter((r) => r.status === "success").length;
  const unknownCount = results.filter((r) => r.status === "unknown").length;

  return NextResponse.json({
    tasks: results,
    summary: { total: results.length, success: successCount, error: errorCount, unknown: unknownCount },
    logDir: LOG_DIR,
    generatedAt: new Date().toISOString(),
  });
}
