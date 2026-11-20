/**
 * Siphon **des positions de lancement** des quêtes du guide Rush — DPLN, en
 * lecture seule. On n'extrait qu'un **fait de jeu** : la ligne
 * « Position de lancement : <zone> [x,y] » du haut de page. Aucun texte de
 * guide n'est recopié.
 *
 *   npx tsx scripts/siphon-rush-quest-positions.ts --limit 5
 *   npx tsx scripts/siphon-rush-quest-positions.ts --apply
 *   npx tsx scripts/siphon-rush-quest-positions.ts --offset 100 --limit 100 --apply
 *
 * La carte `src/data/rush-quest-positions.json` est **fusionnée** : un passage
 * partiel (offset/limit) ne supprime jamais une position déjà mesurée ; elle est
 * réécrite tous les 25 lots pour survivre à une interruption. Le seed ajoute un
 * tag `pos_tags` pour chaque quête présente.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { load } from "cheerio";
import { Client } from "pg";
import {
    positionFromDofusQuestEntry,
    type RushQuestPosition,
} from "../src/lib/rush-quest-positions";

const SOURCE = path.join(process.cwd(), "src", "temp", "trame-rush", "data.json");
const TARGET = path.join(process.cwd(), "src", "data", "rush-quest-positions.json");

const args = process.argv.slice(2);
const valueOf = (flag: string, fallback: string): string => {
    const index = args.indexOf(flag);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const apply = args.includes("--apply");
const limit = Math.max(0, Number(valueOf("--limit", "0")) || 0);
const offset = Math.max(0, Number(valueOf("--offset", "0")) || 0);
const delay = Math.max(250, Number(valueOf("--delay", "1100")) || 1100);

const cleanText = (html: string, selector: string): string =>
    load(html)(selector).text().replace(/\s+/g, " ").trim();

/**
 * Position de lancement : la ligne du haut quand elle existe, sinon le **premier
 * chip du corps** (`.paragraph`) — c'est le cas des pages comme « Faire le mort »,
 * où la position n'est écrite que dans la phrase « La quête se lance … [-26,36] ».
 */
function parsePosition(html: string): { x: number; y: number; zone: string; source: "top" | "body" } | null {
    const body = cleanText(html, "body");
    const top = body.match(/Position de lancement\s*:\s*(.*?)\s*\[(-?\d+)\s*,\s*(-?\d+)\]/i);
    const bodyMatch =
        top
            ? null
            : (cleanText(html, ".paragraph").match(/\[(-?\d+)\s*,\s*(-?\d+)\]/) ??
              body.match(/\[(-?\d+)\s*,\s*(-?\d+)\]/));
    if (!top && !bodyMatch) return null;
    const x = Number(top ? top[2] : bodyMatch![1]);
    const y = Number(top ? top[3] : bodyMatch![2]);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || Math.abs(x) > 1000 || Math.abs(y) > 1000) {
        return null;
    }
    return {
        x,
        y,
        zone: top ? (top[1] ?? "").trim().slice(0, 120) : "",
        source: top ? "top" : "body",
    };
}

type TrameQuest = { id?: number; dnpl?: string | null };

const data = JSON.parse(fs.readFileSync(SOURCE, "utf8")) as {
    quests?: Record<string, TrameQuest>;
};

const all = Object.entries(data.quests ?? {})
    .filter(([, quest]) => typeof quest?.dnpl === "string" && /^https?:\/\//i.test(quest.dnpl))
    .sort(([a], [b]) => Number(a) - Number(b));
const only = valueOf("--only", "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
const selected = only.length
    ? all.filter(([id]) => only.includes(id))
    : all.slice(offset, limit ? offset + limit : undefined);

const existing: Record<string, RushQuestPosition> = fs.existsSync(TARGET)
    ? (JSON.parse(fs.readFileSync(TARGET, "utf8")) as Record<string, RushQuestPosition>)
    : {};
const found: Record<string, RushQuestPosition> = {};
const misses: Array<{ id: string; url: string; reason: string }> = [];

const writeMap = () => {
    if (!apply) return;
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.writeFileSync(TARGET, JSON.stringify({ ...existing, ...found }), "utf8");
};

async function main() {
for (let index = 0; index < selected.length; index += 1) {
    const [id, quest] = selected[index];
    const url = String(quest.dnpl);
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
        const html = await response.text();
        const position = parsePosition(html);
        if (!position) {
            misses.push({ id, url, reason: "position absente (haut et corps)" });
        } else {
            found[id] = { ...position, url, allowZaap: true, worldId: 1 };
        }
    } catch (error) {
        misses.push({ id, url, reason: String(error).slice(0, 200) });
    }

    if ((index + 1) % 20 === 0 || index === selected.length - 1) {
        console.log(
            `[rush-positions] ${index + 1}/${selected.length} · ${Object.keys(found).length} trouvées · ${misses.length} sans position`
        );
    }
    if (apply && (index + 1) % 25 === 0) writeMap();
    await sleep(delay);
}

    // Fallback `DofusQuestEntry` pour les pages qui n'écrivent aucune position
    // (quêtes de la chaîne des Dofus) — positions monde uniquement.
    if (only.length > 0 && misses.length > 0) {
        const ids = [...new Set(misses.map((miss) => Number(miss.id)).filter((id) => Number.isSafeInteger(id)))];
        if (ids.length > 0) {
            const connectionString =
                process.env.DATABASE_URL ??
                `postgresql://${process.env.POSTGRES_USER ?? "user"}:${process.env.POSTGRES_PASSWORD ?? "password"}@localhost:5433/${process.env.POSTGRES_DB ?? "sigilos"}`;
            const client = new Client({ connectionString });
            try {
                await client.connect();
                const result = await client.query(
                    `SELECT "dofusdbId", "posX", "posY", "coords", "zone", "npcSubArea", "npcName"
                     FROM "DofusQuestEntry"
                     WHERE "dofusdbId" = ANY($1)`,
                    [ids]
                );
                for (const row of result.rows as Array<{
                    dofusdbId: number;
                    posX: number;
                    posY: number;
                    coords: unknown;
                    zone: string | null;
                    npcSubArea: string | null;
                    npcName: string | null;
                }>) {
                    // `posX/posY` d'abord, `coords` ensuite : les deux formes coexistent
                    // en base (Incarnam n'a que `coords`, mesuré le 20/11/2026).
                    const position = positionFromDofusQuestEntry(row);
                    if (!position) continue;
                    const id = String(row.dofusdbId);
                    const miss = misses.find((candidate) => candidate.id === id);
                    found[id] = { ...position, url: miss?.url ?? "" };
                    const index = misses.findIndex((candidate) => candidate.id === id);
                    if (index >= 0) misses.splice(index, 1);
                }
            } catch (error) {
                console.warn("[rush-positions] DofusQuestEntry indisponible :", String(error).slice(0, 200));
            } finally {
                await client.end().catch(() => undefined);
            }
        }
    }

writeMap();
console.log(
    `[rush-positions] ${Object.keys(found).length} positions · ${misses.length} sans position · carte ${Object.keys({ ...existing, ...found }).length} entrées`
);
if (misses.length > 0) console.log("[rush-positions] premières absences:", misses.slice(0, 10));
console.log(apply ? `[rush-positions] carte écrite : ${TARGET}` : "[rush-positions] dry-run — relancer avec --apply");
}

void main().catch((error) => {
    console.error(error);
    process.exit(1);
});
