import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getAllCronStatuses, getCronHistory, KNOWN_CRON_TASKS } from "@/lib/cron-telemetry";
import fs from "node:fs";
import path from "node:path";

/**
 * GET /api/god/cron-status
 * Retourne l'état en temps réel des tâches cron (Redis + fallback logs disque).
 * Sécurisé : super-admin uniquement.
 */

const LOG_DIR = "/home/sigiladmin/SigilOS/logs";

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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Récupérer les statuts temps réel depuis Redis
  const telemetryStatuses = await getAllCronStatuses();

  // 1bis. Récupérer l'historique (10 dernières exécutions) de chaque tâche
  const histories = await Promise.all(telemetryStatuses.map((t) => getCronHistory(t.id)));

  // 2. Fusionner avec les fichiers logs disque si existants
  const results = telemetryStatuses.map((task, idx) => {
    const meta = KNOWN_CRON_TASKS[task.id];
    const logFile = meta?.logFile;
    let sizeBytes = 0;
    let diskLastRun: string | null = null;
    let diskLines: string[] = [];

    if (logFile) {
      const logPath = path.join(LOG_DIR, logFile);
      const stats = getFileStats(logPath);
      sizeBytes = stats.sizeBytes;
      if (stats.mtime) diskLastRun = stats.mtime.toISOString();
      diskLines = readLastLines(logPath, 30);
    }

    // Si on a un log disque plus récent ou si Redis est vide mais disque a des données
    const lastRun = task.lastRun || diskLastRun;
    const finalLines = task.lines && task.lines.length > 0 
      ? task.lines 
      : (diskLines.length > 0 ? diskLines.slice(-10) : (task.summary ? [task.summary] : []));

    return {
      id: task.id,
      name: task.name,
      schedule: task.schedule,
      logFile: logFile || `${task.id}.json`,
      lastRun,
      durationMs: task.durationMs,
      sizeBytes,
      status: task.status,
      summary: task.summary,
      details: task.details ?? null,
      lastLines: finalLines,
      history: histories[idx] ?? [],
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
