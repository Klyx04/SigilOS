/**
 * Missions — **résolveur unique de l'illustration** (règle pure, client + serveur).
 *
 * Pourquoi ce fichier existe (mesure du 17/11/2026, modale « Éditer le slot ») :
 * le catalogue officiel ne porte un visuel que pour les donjons, expéditions et une partie
 * des événements (`monsterImageUrl`). Pour les **Songes** (23), les **Anomalies** (17) et les
 * **Régulations** (135), ce champ est **`null`** : la recherche de catalogue, l'aperçu en
 * direct et la carte du dashboard retombaient donc sur le pictogramme générique `∞`, alors
 * que les illustrations sont **déjà sur le disque**.
 * Le mapping existait en trois exemplaires divergents (`mission-card.tsx`, `mission-editor.tsx`,
 * `MissionLivePreview.tsx`) — il vit désormais **ici**, et nulle part ailleurs.
 *
 * Sources des visuels (toutes locales, aucun hotlink) :
 *   • Songes       → `public/assets/missions/{reve|paradoxe|cauchemar}<n>.png` + `epreuves-songes/<Nom>.png`
 *   • Anomalies    → `public/assets/missions/{fragment|3-gardiens|ano1|anomalie}.png`
 *   • Régulations  → `public/game-data/monsters/<famille>.webp` calculé par règle (voir plus bas)
 *   • Donjons / expéditions / événements → proxy `/api/assets-dofus/monsters/<id>` (auto-siphon,
 *     jamais de 404 — cf. `src/app/api/assets-dofus/[type]/[id]/route.ts`)
 *
 * ⚠️ **Le disque local n'est pas l'autorité** (mesure du 17/11/2026) : en production,
 * `public/game-data` est un **bind mount** (`/home/sigiladmin/SigilOS/public/game-data`,
 * `docker-compose.prod.yml`) alimenté par `sync-assets.sh` — il peut contenir des familles
 * plus récentes que le dépôt. Le chemin d'une famille est donc **calculé par une règle**
 * (translittération historique + 4 alias mesurés), jamais validé contre une liste figée :
 * une nouvelle image déposée sur le VPS s'affiche sans redéploiement du code.
 * Si le fichier n'existe pas encore, le composant retombe sur `fallbackUrl`
 * (`MissionArtworkImage`) — jamais de vignette vide.
 *
 * ⚠️ Aucun accès `fs` : ce module est importé par des composants client.
 */

import type { MissionCategory } from "@prisma/client";
import { normalizeDofusAssetStoredUrl, resolveDofusAssetImageUrl } from "@/lib/dofus-image-url";
import { missionCategoryImage } from "@/lib/mission-category-images";

/** Épreuves de Songes (mêmes codes que `SONGES_CONFIG.epreuves`). */
export const SONGES_EPREUVES = ["Fonsocac", "Nilezaff", "Reversed", "Sinjsonj"] as const;
export type SongesEpreuve = (typeof SONGES_EPREUVES)[number];

export interface MissionArtworkInput {
    category: MissionCategory | string;
    title?: string | null;
    monsterId?: number | string | null;
    monsterImageUrl?: string | null;
    payload?: Record<string, unknown> | null;
}

export interface MissionArtwork {
    /** Chemin servi (local ou proxy interne), `null` seulement pour une catégorie inconnue. */
    imageUrl: string | null;
    /** Repli visuel (bannière/picto de catégorie) quand le fichier précis manque sur ce serveur. */
    fallbackUrl: string | null;
    /** Code d'épreuve détecté (Songes) — permet au mapping de renseigner `payload.epreuve`. */
    epreuve: SongesEpreuve | null;
}

/**
 * Alias **mesurés** entre le titre officiel et le nom de fichier du VPS
 * (`prisma/seed-data/game-data.json` : `Blops` → `blop`, `Calcinés` → `kl-mort`,
 * `Cuirassés` → `harrogant` ; et le titre du catalogue écrit « Brûlâmes » là où la
 * famille s'appelle « Brûlames »). Clé = slug calculé, valeur = fichier réel.
 */
const FAMILY_SLUG_ALIASES: Record<string, string> = {
    "blops": "blop",
    "br-l-mes": "br-lames",
    "calcin-s": "kl-mort",
    "cuirass-s": "harrogant",
};

/** Niveaux réellement illustrés (aucun `cauchemar4.png` n'existe — on ne l'invente pas). */
const SONGES_MAX_LEVEL: Record<string, number> = {
    reve: 3,
    paradoxe: 4,
    cauchemar: 3,
};

const ROMAN_LEVELS: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };

/** Minuscules + accents retirés (garde les chiffres romains). */
function normalizeText(value: string): string {
    return value
        .toLowerCase()
        // « cœur » est une ligature : NFD ne la décompose pas, on l'ouvre explicitement.
        .replace(/œ/g, "oe")
        .replace(/æ/g, "ae")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

/**
 * Slug **historique** des assets de familles : tout caractère hors `[a-z0-9]` devient un
 * tiret (« Nécrotiques » → `n-crotiques`, « Égarés » → `gar-s`), tirets de bord retirés.
 */
export function missionFamilySlug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Slug d'une famille à partir du titre officiel (« Régulation des Miséreux » → `mis-reux`).
 * `null` quand le titre ne suit pas le schéma « Régulation … ».
 */
export function regulationFamilySlug(title: string | null | undefined): string | null {
    if (typeof title !== "string") return null;
    const rest = title.replace(/^r[ée]gulation\s+(?:des\s+|de la\s+|de l['’]\s*|du\s+|d['’]\s*)/i, "").trim();
    if (!rest || rest === title.trim()) return null;
    return missionFamilySlug(rest);
}

/** Chemin calculé d'une famille — **règle seule**, jamais une liste figée (VPS = autorité). */
export function monsterFamilyArtworkUrl(title: string | null | undefined): string | null {
    const slug = regulationFamilySlug(title);
    if (!slug) return null;
    const asset = FAMILY_SLUG_ALIASES[slug] ?? slug;
    return `/game-data/monsters/${asset}.webp`;
}

/** Épreuve détectée depuis `payload.epreuve` ou le titre (« Épreuve FONSOCAC »). */
export function resolveSongesEpreuve(
    title?: string | null,
    payload?: Record<string, unknown> | null,
): SongesEpreuve | null {
    const raw = typeof payload?.epreuve === "string" ? payload.epreuve : "";
    const haystack = normalizeText(`${raw} ${title ?? ""}`);
    return SONGES_EPREUVES.find((code) => haystack.includes(normalizeText(code))) ?? null;
}

/**
 * Chemin d'une image **déjà stockée** : conservé s'il appartient à nos dossiers servis,
 * sinon `null` (jamais d'URL arbitraire posée dans le DOM). Le chemin legacy
 * `/uploads/assets-dofus/monsters/<id>.webp` est réécrit vers le proxy canonique.
 */
function storedLocalImage(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    if (raw.startsWith("/uploads/assets-dofus/monsters/")) {
        return normalizeDofusAssetStoredUrl("monsters", raw);
    }
    if (
        raw.startsWith("/api/assets-dofus/") ||
        raw.startsWith("/assets/") ||
        raw.startsWith("/banners/") ||
        raw.startsWith("/game-data/")
    ) {
        return raw;
    }
    return null;
}

function resolveSongesArtwork(input: MissionArtworkInput): MissionArtwork {
    const fallbackUrl = missionCategoryImage("SONGES");
    const epreuve = resolveSongesEpreuve(input.title, input.payload);
    if (epreuve) {
        return { imageUrl: `/assets/missions/epreuves-songes/${epreuve}.png`, fallbackUrl, epreuve };
    }

    // Le titre officiel est la source qui fait autorité (« Plongée en Paradoxe IV ») ;
    // `payload.difficulty`/`payload.level` ne servent qu'aux missions personnalisées.
    const title = normalizeText(String(input.title ?? ""));
    const fromTitle = title.match(/\b(reve|paradoxe|cauchemar)\s+(iv|iii|ii|i)\b/);
    const payloadDifficulty = normalizeText(String(input.payload?.difficulty ?? ""));
    const payloadLevel = normalizeText(String(input.payload?.level ?? ""));

    const difficulty = fromTitle?.[1] ?? payloadDifficulty;
    const roman = fromTitle?.[2] ?? payloadLevel;
    const level = ROMAN_LEVELS[roman];
    const max = SONGES_MAX_LEVEL[difficulty];

    if (max && level && level <= max) {
        return { imageUrl: `/assets/missions/${difficulty}${level}.png`, fallbackUrl, epreuve: null };
    }
    return { imageUrl: fallbackUrl, fallbackUrl, epreuve: null };
}

function resolveAnomalieArtwork(input: MissionArtworkInput): MissionArtwork {
    const fallbackUrl = missionCategoryImage("ANOMALIE");
    // Les visuels d'anomalie se distinguent par l'OBJECTIF, pas par la catégorie (toujours « Anomalie »).
    const title = normalizeText(String(input.title ?? ""));
    if (title.includes("fragment")) {
        return { imageUrl: "/assets/missions/fragment.png", fallbackUrl, epreuve: null };
    }
    if (title.includes("gardien") || title.includes("stabilisation de donjon")) {
        return { imageUrl: "/assets/missions/3-gardiens.png", fallbackUrl, epreuve: null };
    }
    if (title.includes("coeur de l'anomalie")) {
        return { imageUrl: "/assets/missions/anomalie.png", fallbackUrl, epreuve: null };
    }

    // Missions personnalisées : le formulaire ne stocke que le type d'objectif.
    switch (input.payload?.type) {
        case "FRAGMENTS":
        case "COLLECTE":
            return { imageUrl: "/assets/missions/fragment.png", fallbackUrl, epreuve: null };
        case "STABILISATION":
        case "GARDIENS":
        case "BOSS":
            return { imageUrl: "/assets/missions/3-gardiens.png", fallbackUrl, epreuve: null };
        default:
            return { imageUrl: "/assets/missions/ano1.png", fallbackUrl, epreuve: null };
    }
}

function resolveRegulationArtwork(input: MissionArtworkInput): MissionArtwork {
    const fallbackUrl = missionCategoryImage("REGULATION");
    const explicit = storedLocalImage(input.payload?.imageUrl);
    const family = monsterFamilyArtworkUrl(input.title);
    const monster = resolveDofusAssetImageUrl("monsters", input.monsterId ?? null);
    return {
        imageUrl: family ?? explicit ?? monster ?? fallbackUrl,
        fallbackUrl,
        epreuve: null,
    };
}

function resolveMonsterArtwork(input: MissionArtworkInput): MissionArtwork {
    const fallbackUrl = missionCategoryImage(input.category);
    const explicit = storedLocalImage(input.payload?.imageUrl) ?? storedLocalImage(input.monsterImageUrl);
    const payloadMonsterId = input.payload?.monsterId;
    const payloadId =
        typeof payloadMonsterId === "string" || typeof payloadMonsterId === "number"
            ? payloadMonsterId
            : null;
    const monster = resolveDofusAssetImageUrl("monsters", input.monsterId ?? payloadId);
    return {
        imageUrl: explicit ?? monster ?? fallbackUrl,
        fallbackUrl,
        epreuve: null,
    };
}

/**
 * Illustration d'une mission, quelle que soit sa provenance (catalogue officiel, payload
 * édité, mission en base). **Unique** point de décision : les composants ne doivent plus
 * construire de chemin eux-mêmes.
 */
export function resolveMissionArtwork(input: MissionArtworkInput): MissionArtwork {
    switch (input.category) {
        case "SONGES":
            return resolveSongesArtwork(input);
        case "ANOMALIE":
            return resolveAnomalieArtwork(input);
        case "REGULATION":
            return resolveRegulationArtwork(input);
        case "DONJON":
        case "EXPEDITION":
        case "EVENT":
            return resolveMonsterArtwork(input);
        default:
            return { imageUrl: null, fallbackUrl: null, epreuve: null };
    }
}
