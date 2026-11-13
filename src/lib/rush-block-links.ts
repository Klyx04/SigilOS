/**
 * Règles pures des **liens externes d'un bloc Rush** (12/11/2026).
 *
 * Un bloc Combat / Conseil peut porter jusqu'à **10 liens nommés** (vidéo YouTube,
 * guide écrit). Le nom est affiché, l'URL ouvre un nouvel onglet et sa favicon est
 * résolue à l'affichage. Le stockage vit dans `GuideMilestone.links` (JSON) ; ici,
 * on borne et on valide — jamais le client seul.
 */

import { safeExternalUrl } from "@/lib/security";

export type RushBlockLink = { label: string; url: string };

export const RUSH_BLOCK_LINKS_MAX = 10;
export const RUSH_BLOCK_LINK_LABEL_MAX = 120;
export const RUSH_BLOCK_LINK_URL_MAX = 500;

/** URL http(s) sûre, normalisée par `safeExternalUrl` (`javascript:` refusé). */
export function isSafeRushLinkUrl(value: string | null | undefined): boolean {
  const url = (value ?? "").trim();
  if (!url || url.length > RUSH_BLOCK_LINK_URL_MAX) return false;
  return safeExternalUrl(url).length > 0;
}

/** Hôte d'un lien (pour la favicon), ou `null` si l'URL n'est pas sûre. */
export function hostOfRushLink(value: string): string | null {
  const safe = safeExternalUrl(value);
  if (!safe) return null;
  try {
    return new URL(safe).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Lecture **tolérante** : une entrée invalide est ignorée (pas de crash sur une
 * donnée ancienne), les autres sont conservées dans l'ordre. Bornes : 10 liens,
 * libellé 120 caractères, URL 500.
 */
export function parseRushBlockLinks(value: unknown): RushBlockLink[] {
  if (!Array.isArray(value)) return [];
  const out: RushBlockLink[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const candidate = row as { label?: unknown; url?: unknown };
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
    if (!label || !isSafeRushLinkUrl(url)) continue;
    out.push({
      label: label.slice(0, RUSH_BLOCK_LINK_LABEL_MAX),
      url: safeExternalUrl(url),
    });
    if (out.length >= RUSH_BLOCK_LINKS_MAX) break;
  }
  return out;
}

/** Écriture : lecture tolérante + dédoublonnage par URL (premier libellé gagnant). */
export function normalizeRushBlockLinks(value: unknown): RushBlockLink[] {
  const seen = new Set<string>();
  const out: RushBlockLink[] = [];
  for (const link of parseRushBlockLinks(value)) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    out.push(link);
  }
  return out;
}
