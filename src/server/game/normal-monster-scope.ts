/**
 * Périmètre des **monstres normaux** — source unique côté serveur.
 *
 * Un « monstre normal » = une créature du bestiaire local du client
 * (`public/game-data/unity-bestiary.json`, 5 129 entrées) **qui n'a pas déjà sa fiche** :
 * ni boss de donjon (y compris de raid / d'anomalie), ni avis de recherche, ni titan.
 * Ces exclusions sont les **noms réellement en base** — une créature publiée demain est
 * exclue sans toucher au code, et le rapprochement se fait par le **slug** (`slugifyBossName`,
 * le même que les fiches et les URL publiques : accents, casse et ponctuation ignorés).
 *
 * Deux consommateurs, une seule définition : les actions de liste/recherche
 * (`game-data-actions`) et le **sitemap** (qui ne référence que les fiches dont le contenu
 * est réellement siphonné, donc indexables — les autres sont en `noindex`).
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { slugifyBossName } from "@/lib/boss-slug";
import { findUnityMonsterBySlug } from "@/lib/unity-bestiary";

/** La liste ne bouge qu'au fil du siphon : mémo 10 min (une frappe ne requête pas la base). */
const EXCLUDED_KEYS_TTL = 10 * 60 * 1000;
let excludedKeysCache: { keys: Set<string>; expiresAt: number } | null = null;

/**
 * Slugs des créatures qui ont **déjà** leur fiche : boss de donjon (dont raid et anomalie),
 * avis de recherche, titans. Fail-soft assumé : sur incident base, l'ensemble est vide (au
 * pire une créature de plus apparaît dans une **liste publique** — jamais un accès accordé).
 */
export async function excludedNormalMonsterKeys(): Promise<Set<string>> {
    const now = Date.now();
    if (excludedKeysCache && excludedKeysCache.expiresAt > now) return excludedKeysCache.keys;

    const keys = new Set<string>();
    try {
        const [dungeons, bounties, titans] = await Promise.all([
            db.dungeon.findMany({ select: { name: true, bossName: true } }),
            db.bounty.findMany({ select: { name: true } }),
            db.titan.findMany({ select: { name: true } }),
        ]);
        for (const dungeon of dungeons) {
            for (const candidate of [dungeon.bossName, dungeon.name]) {
                const slug = slugifyBossName(String(candidate ?? ""));
                if (slug) keys.add(slug);
            }
        }
        for (const row of [...bounties, ...titans]) {
            const slug = slugifyBossName(String(row.name ?? ""));
            if (slug) keys.add(slug);
        }
        excludedKeysCache = { keys, expiresAt: now + EXCLUDED_KEYS_TTL };
    } catch (e) {
        logger.warn("[excludedNormalMonsterKeys] Exclusions indisponibles (liste servie sans exclusion):", { error: String(e) });
    }
    return keys;
}

export interface SiphonedNormalMonsterSlug {
    slug: string;
    lastSyncedAt: Date | null;
}

/**
 * Fiches de monstres **siphonnées** (donc avec du contenu réel : butin, encyclopédie, zone)
 * **et** normales — jamais un boss / avis / titan, qui a déjà sa page `/boss/<slug>`.
 * Sert au sitemap : une page servie par le seul bestiaire local du client reste en `noindex`.
 */
export async function listSiphonedNormalMonsterSlugs(): Promise<SiphonedNormalMonsterSlug[]> {
    const excluded = await excludedNormalMonsterKeys();
    const rows = await db.monsterStat.findMany({
        select: { monsterName: true, lastSyncedAt: true },
        orderBy: { monsterName: "asc" },
    });
    const seen = new Set<string>();
    const out: SiphonedNormalMonsterSlug[] = [];
    for (const row of rows) {
        const slug = slugifyBossName(String(row.monsterName ?? ""));
        if (!slug || seen.has(slug) || excluded.has(slug)) continue;
        /**
         * 🔴 Mesure du 11/10/2026 : `MonsterStat` contient des noms **parasites** de siphon
         * (`monsterName = "[object Object]"` → slug `object-object`) et le sitemap publiait
         * `/bestiaire/object-object`… qui répond **404** (« Submitted URL not found » côté GSC,
         * et un 404 dans un sitemap coûte la confiance du crawl).
         * Une URL du sitemap doit répondre 200 : on ne garde donc qu'un slug qui **résout
         * réellement** dans le bestiaire local du client (index mémoïsé, coût nul), qui est la
         * source de la fiche publique. Le sommaire `/bestiaire` applique exactement la même
         * règle (il construit ses liens sur le même index) : sitemap et sommaire coïncident.
         */
        if (!findUnityMonsterBySlug(slug)) continue;
        seen.add(slug);
        out.push({ slug, lastSyncedAt: row.lastSyncedAt ?? null });
    }
    return out;
}
