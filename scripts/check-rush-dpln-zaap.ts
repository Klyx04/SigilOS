/**
 * Contrôle **ISO dofuspourlesnoobs** des positions et du zaap du guide Rush.
 *
 * DPLN n'affiche pas toujours le zaap : une coordonnée suivie de `!`
 * (`[x,y!]`), une page `.no-auto-zaap`, ou une annotation explicite
 * `[x,y (zaap zx,zy)]` changent le bouton. Le siphon historique posait
 * `allowZaap: true` partout — ce contrôle mesure l'écart et peut le corriger.
 *
 *   npx tsx scripts/check-rush-dpln-zaap.ts                 # dry-run complet
 *   npx tsx scripts/check-rush-dpln-zaap.ts --limit 30      # échantillon
 *   npx tsx scripts/check-rush-dpln-zaap.ts --apply         # écrit le JSON
 *
 * Lecture seule sur DPLN (aucun texte de guide recopié) ; la carte
 * `src/data/rush-quest-positions.json` reste la source de vérité.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const TARGET = path.join(process.cwd(), "src", "data", "rush-quest-positions.json");

type Position = {
  x: number;
  y: number;
  zone?: string;
  source?: string;
  url?: string;
  allowZaap?: boolean;
  worldId?: number;
  mapId?: number;
  zaapX?: number;
  zaapY?: number;
};

const args = process.argv.slice(2);
const valueOf = (flag: string, fallback: string): string => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const apply = args.includes("--apply");
const limit = Math.max(0, Number(valueOf("--limit", "0")) || 0);
const offset = Math.max(0, Number(valueOf("--offset", "0")) || 0);
const delay = Math.max(250, Number(valueOf("--delay", "700")) || 700);

const decode = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&eacute;|&egrave;|&ecirc;/gi, "e")
    .replace(/\s+/g, " ")
    .trim();

type Parsed = {
  x: number;
  y: number;
  excluded: boolean;
  zaap: { x: number; y: number } | null;
  explicitZaap: boolean;
  noAuto: boolean;
};

function parsePage(html: string): Parsed | null {
  const text = decode(html);
  const noAuto = /no-auto-zaap/.test(html);
  // Ligne du haut : « Position de lancement : Zone [x,y] » (le `!` éventuel fait
  // partie du format DPLN, avant ou après l'annotation zaap).
  const top = text.match(
    /Position de lancement\s*:\s*.*?\[(-?\d+)\s*,\s*(-?\d+)(!)?\](?:\s*\(zaap\s+(-?\d+)\s*,\s*(-?\d+)(!)?\))?/i
  );
  const coords = top
    ? {
        x: Number(top[1]),
        y: Number(top[2]),
        excluded: top[3] === "!",
        zx: top[4] != null ? Number(top[4]) : null,
        zy: top[5] != null ? Number(top[5]) : null,
      }
    : (() => {
        const body = text.match(
          /\[(-?\d+)\s*,\s*(-?\d+)(!)?\](?:\s*\(zaap\s+(-?\d+)\s*,\s*(-?\d+)(!)?\))?/
        );
        if (!body) return null;
        return {
          x: Number(body[1]),
          y: Number(body[2]),
          excluded: body[3] === "!",
          zx: body[4] != null ? Number(body[4]) : null,
          zy: body[5] != null ? Number(body[5]) : null,
        };
      })();
  if (!coords) return null;
  if (!Number.isSafeInteger(coords.x) || !Number.isSafeInteger(coords.y)) return null;
  const explicitZaap = coords.zx != null && coords.zy != null;
  return {
    x: coords.x,
    y: coords.y,
    excluded: coords.excluded || noAuto,
    explicitZaap,
    noAuto,
    zaap:
      explicitZaap && Number.isSafeInteger(coords.zx) && Number.isSafeInteger(coords.zy)
        ? { x: coords.zx as number, y: coords.zy as number }
        : null,
  };
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(TARGET, "utf8")) as Record<string, Position>;
  const entries = Object.entries(existing)
    .filter(([, position]) => typeof position?.url === "string" && /^https?:\/\//i.test(position.url))
    .sort(([a], [b]) => Number(a) - Number(b))
    .slice(offset, limit ? offset + limit : undefined);

  const report = {
    checked: 0,
    samePosition: 0,
    positionMismatch: [] as Array<{ id: string; expected: string; found: string }>,
    excludedByDpln: [] as Array<{ id: string; url: string }>,
    explicitZaap: [] as Array<{ id: string; zaap: string }>,
    noAutoPages: [] as Array<{ id: string; url: string }>,
    misses: [] as Array<{ id: string; url: string; reason: string }>,
    updated: 0,
  };

  const next: Record<string, Position> = { ...existing };

  for (let index = 0; index < entries.length; index += 1) {
    const [id, position] = entries[index];
    const url = String(position.url);
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; SigilOS/1.0; +https://sigilos.fr)",
          "accept-language": "fr-FR,fr;q=0.9",
          accept: "text/html",
        },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = parsePage(await response.text());
      if (!parsed) {
        report.misses.push({ id, url, reason: "position absente" });
      } else {
        report.checked += 1;
        if (parsed.x !== position.x || parsed.y !== position.y) {
          report.positionMismatch.push({
            id,
            expected: `${position.x},${position.y}`,
            found: `${parsed.x},${parsed.y}`,
          });
        } else {
          report.samePosition += 1;
        }
        if (parsed.excluded) report.excludedByDpln.push({ id, url });
        if (parsed.noAuto) report.noAutoPages.push({ id, url });
        if (parsed.explicitZaap && parsed.zaap) {
          report.explicitZaap.push({ id, zaap: `${parsed.zaap.x},${parsed.zaap.y}` });
        }
        const allowZaap = !parsed.excluded;
        const nextPosition: Position = {
          ...position,
          allowZaap,
          ...(parsed.zaap ? { zaapX: parsed.zaap.x, zaapY: parsed.zaap.y } : {}),
        };
        if (
          allowZaap !== position.allowZaap ||
          nextPosition.zaapX !== position.zaapX ||
          nextPosition.zaapY !== position.zaapY
        ) {
          next[id] = nextPosition;
          report.updated += 1;
        }
      }
    } catch (error) {
      report.misses.push({ id, url, reason: String(error).slice(0, 160) });
    }
    if ((index + 1) % 25 === 0 || index === entries.length - 1) {
      console.log(
        `[dpln-zaap] ${index + 1}/${entries.length} · ${report.samePosition} positions identiques · ${report.excludedByDpln.length} exclues · ${report.explicitZaap.length} zaap explicites · ${report.misses.length} absences`
      );
    }
    if (apply && report.updated > 0 && (index + 1) % 50 === 0) {
      fs.writeFileSync(TARGET, JSON.stringify(next), "utf8");
    }
    await sleep(delay);
  }

  if (apply && report.updated > 0) fs.writeFileSync(TARGET, JSON.stringify(next), "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log(
    apply
      ? `[dpln-zaap] carte écrite : ${TARGET} (${report.updated} entrées)`
      : "[dpln-zaap] dry-run — relancer avec --apply pour corriger le JSON"
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
