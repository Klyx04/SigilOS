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
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { load } from "cheerio";
import type { RushQuestPosition } from "../src/lib/rush-quest-positions";

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

type TrameQuest = { id?: number; dnpl?: string | null };

const data = JSON.parse(fs.readFileSync(SOURCE, "utf8")) as {
    quests?: Record<string, TrameQuest>;
};

const all = Object.entries(data.quests ?? {})
    .filter(([, quest]) => typeof quest?.dnpl === "string" && /^https?:\/\//i.test(quest.dnpl))
    .sort(([a], [b]) => Number(a) - Number(b));
const selected = all.slice(offset, limit ? offset + limit : undefined);

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
        const text = load(html)("body").text().replace(/\s+/g, " ");
        const match = text.match(/Position de lancement\s*:\s*(.*?)\s*\[(-?\d+)\s*,\s*(-?\d+)\]/i);
        if (!match) {
            misses.push({ id, url, reason: "position absente" });
        } else {
            const x = Number(match[2]);
            const y = Number(match[3]);
            if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || Math.abs(x) > 1000 || Math.abs(y) > 1000) {
                throw new Error(`coordonnées hors bornes (${match[2]},${match[3]})`);
            }
            found[id] = { x, y, zone: match[1].trim().slice(0, 120), url };
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
