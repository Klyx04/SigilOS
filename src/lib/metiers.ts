import { getJob } from "@/lib/dofus-assets";

/** Entrée métier canonique d'un profil (id de job, nom, niveau). */
export type MetierEntry = { id: string; name: string; level: number };

/**
 * Normalise `UserProfile.metiers` (legacy `string[]` de slugs métiers — niveau
 * inconnu → convention **200** — ou format enrichi `{name|id, level}`) vers
 * `MetierEntry[]`. Rétro-compatible : ne casse aucun consommateur existant.
 */
export function normalizeMetiers(raw: unknown): MetierEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: MetierEntry[] = [];
  const seen = new Set<string>();
  for (const e of raw) {
    let id = "";
    let name = "";
    let level = 200; // convention : les métiers renseignés sont maxés à 200.
    if (typeof e === "string") {
      const job = getJob(e);
      id = job?.id || e;
      name = job?.name || e;
    } else if (e && typeof e === "object") {
      const o = e as any;
      const job = getJob(o.name || o.id);
      id = typeof o.id === "string" ? o.id : job?.id || (typeof o.name === "string" ? o.name : "");
      name = typeof o.name === "string" ? o.name : job?.name || "";
      if (typeof o.level === "number") level = o.level;
    }
    if (!name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, level: Math.max(1, Math.min(200, Math.round(level))) });
  }
  return out;
}

/** Noms de métiers à partir de toute forme de `metiers` (pour affichage). */
export function metierNames(raw: unknown): string[] {
  return normalizeMetiers(raw).map((m) => m.name);
}

/** Ids de jobs (slugs) à partir de toute forme de `metiers` (pour filtres/comparaisons). */
export function metierIds(raw: unknown): string[] {
  return normalizeMetiers(raw).map((m) => m.id);
}
