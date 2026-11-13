/**
 * Table **locale** des PNJ (noms) — `prisma/seed-data/npcs/npcs-client.json`, siphonné du client
 * Dofus (`scripts/siphon-npcs-client.py`, 6 494 entrées `{ id, name, look, gender }`).
 *
 * Mise en cache process : le fichier (~575 Ko) est lu **une fois** par runtime, jamais par requête.
 * Le fichier est embarqué dans l'image (le Dockerfile copie `prisma/`) : rien à télécharger, et
 * aucune dépendance à DofusDB pour afficher un nom de PNJ.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { NpcNameEntry } from "@/lib/npc-name";

let cache: NpcNameEntry[] | null | undefined;

/** Les PNJ connus (`[]` si le fichier manque — on n'affiche alors aucun nom, jamais un faux). */
export function getNpcEntries(): NpcNameEntry[] {
    if (cache !== undefined) return cache ?? [];
    try {
        const raw = readFileSync(join(process.cwd(), "prisma", "seed-data", "npcs", "npcs-client.json"), "utf8");
        const parsed = JSON.parse(raw);
        cache = Array.isArray(parsed)
            ? (parsed as { id?: unknown; name?: unknown }[])
                .map((entry) => ({ id: Number(entry?.id), name: typeof entry?.name === "string" ? entry.name : "" }))
                .filter((entry) => Number.isSafeInteger(entry.id) && entry.id > 0 && entry.name !== "")
            : [];
    } catch {
        cache = [];
    }
    return cache;
}
