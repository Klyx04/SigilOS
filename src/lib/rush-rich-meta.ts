/**
 * Utilitaires pour la gestion structurée des métadonnées enrichies des blocs
 * (Conseil / Tips, Séparateur) du Rush Sylvestre.
 *
 * Permet d'extraire et combiner de façon fiable :
 * - Une position / coordonnée copiable (ex: "[-55, 15]", "2, 1", "/w 2, 1")
 * - Un lien externe (URL + nom du lien optionnel)
 * - Une note / texte explicatif
 *
 * Règle d'or : rétrocompatibilité totale avec les chaînes existantes
 * sans nécessiter de modification de schéma de base de données.
 */

import { safeImageUrl } from "./security";

export interface ParsedBlockMeta {
  coord: string;
  linkUrl: string;
  linkLabel: string;
  text: string;
}

/**
 * Regex pour capturer une position dans ses différentes variantes :
 * [x, y], [x, y, world], /w x,y, /travel x y, ou x, y direct
 */
const COORD_REGEX = /\[\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*\d+)?\s*\]|\/(?:w|travel)\s+(-?\d+)\s*[,;]?\s*(-?\d+)(?:\s*,\s*\d+)?(?!\d)|^\s*(-?\d+)\s*[,;]\s*(-?\d+)\s*$/i;

/**
 * Regex pour capturer un lien nommé markdown : [Label](https://...)
 */
const NAMED_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\)\s]+)\)/i;

/**
 * Regex pour capturer une URL brute http(s)
 */
const RAW_URL_REGEX = /(https?:\/\/[^\s]+)/i;

/**
 * Analyse le contenu brut d'un bloc (tips ou description) et sépare proprement
 * la position, le lien externe et le texte libre restant.
 */
export function parseBlockMeta(content?: string | null): ParsedBlockMeta {
  if (!content) {
    return { coord: "", linkUrl: "", linkLabel: "", text: "" };
  }

  let remaining = content;
  let coord = "";
  let linkUrl = "";
  let linkLabel = "";

  // 1. Extraire la position
  const coordMatch = COORD_REGEX.exec(remaining);
  if (coordMatch) {
    const rawX = coordMatch[1] ?? coordMatch[3] ?? coordMatch[5];
    const rawY = coordMatch[2] ?? coordMatch[4] ?? coordMatch[6];
    if (rawX !== undefined && rawY !== undefined) {
      coord = `${rawX}, ${rawY}`;
      remaining = remaining.replace(coordMatch[0], " ");
    }
  }

  // 2. Extraire le lien nommé
  const namedLinkMatch = NAMED_LINK_REGEX.exec(remaining);
  if (namedLinkMatch) {
    linkLabel = namedLinkMatch[1].trim();
    linkUrl = namedLinkMatch[2].trim();
    remaining = remaining.replace(namedLinkMatch[0], " ");
  } else {
    // 3. Extraire une URL brute si pas de lien nommé
    const rawUrlMatch = RAW_URL_REGEX.exec(remaining);
    if (rawUrlMatch) {
      let url = rawUrlMatch[1].trim();
      const punct = /[.,;:!?]+$/.exec(url)?.[0] ?? "";
      if (punct) {
        url = url.slice(0, -punct.length);
      }
      linkUrl = url;
      remaining = remaining.replace(rawUrlMatch[0], punct ? " " + punct : " ");
    }
  }

  // 4. Nettoyer le texte restant (retirer les lignes vides et espaces résiduels)
  const cleanText = remaining
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();

  return {
    coord,
    linkUrl,
    linkLabel,
    text: cleanText,
  };
}

/**
 * Formate de façon standardisée les métadonnées pour le stockage en base.
 * Ordre canonique :
 * 1. [x, y]
 * 2. [Nom](url)
 * 3. Texte libre restant
 */
export function formatBlockMeta({
  coord,
  linkUrl,
  linkLabel,
  text,
}: {
  coord?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  text?: string | null;
}): string {
  const parts: string[] = [];

  const trimmedCoord = (coord || "").trim();
  if (trimmedCoord) {
    // Normaliser en [x, y]
    const m = trimmedCoord.match(/(-?\d+)\s*,\s*(-?\d+)/);
    if (m) {
      parts.push(`[${m[1]}, ${m[2]}]`);
    } else if (trimmedCoord.startsWith("[") && trimmedCoord.endsWith("]")) {
      parts.push(trimmedCoord);
    } else {
      parts.push(`[${trimmedCoord}]`);
    }
  }

  const trimmedUrl = (linkUrl || "").trim();
  if (trimmedUrl) {
    const trimmedLabel = (linkLabel || "").trim();
    if (trimmedLabel) {
      parts.push(`[${trimmedLabel}](${trimmedUrl})`);
    } else {
      parts.push(trimmedUrl);
    }
  }

  const trimmedText = (text || "").trim();
  if (trimmedText) {
    parts.push(trimmedText);
  }

  return parts.join("\n");
}

/**
 * Vérifie si une coordonnée saisie est valide (ex: "-55, 15", "[-55,15]", "/w -55, 15").
 */
export function validateCoordinate(input: string): { x: number; y: number; formatted: string } | null {
  if (!input) return null;
  const m = COORD_REGEX.exec(input.trim());
  if (!m) return null;
  const rawX = m[1] ?? m[3] ?? m[5];
  const rawY = m[2] ?? m[4] ?? m[6];
  if (rawX === undefined || rawY === undefined) return null;
  const x = parseInt(rawX, 10);
  const y = parseInt(rawY, 10);
  if (isNaN(x) || isNaN(y)) return null;
  return { x, y, formatted: `${x}, ${y}` };
}
