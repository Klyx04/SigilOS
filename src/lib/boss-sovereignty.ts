/**
 * Souveraineté des fiches boss — **règle pure** (lot 6).
 *
 * Mesure du 18/10/2026 : **207** donjons en base, **187** donjons dans le catalogue local
 * (`public/game-data/dungeon-monsters.json`). Les 20 autres n'ont **aucune** donnée locale
 * (monstres de salle, famille) : la fiche retombe sur un repli réseau sans le dire.
 *
 * Ce module ne lit rien : il reçoit les deux listes et rend un recensement **honnête**
 * (couverture réelle, liste bornée, perte **dite**). Aucun I/O, aucun `Date.now()`.
 */

import { bossMatchKey } from "./data-health";

/**
 * Clé de comparaison **base ↔ catalogue** : `bossMatchKey` (accents, casse, cas
 * particuliers) puis suppression de tout séparateur — le catalogue stocke `cleanName`
 * **collé** (« courdubouftouroyal ») alors que la base garde les espaces
 * (« Cour du Bouftou Royal »). Sans cette étape, **aucun** donjon ne matchait.
 *
 * ⚠️ Constat du 20/10/2026 sur la bêta : **34** donjons de la base n'avaient aucune entrée
 * locale (le bandeau « Fiche partielle » s'affichait sur 34 des 151 fiches publiées). Après
 * vérification nom par nom, **9** d'entre eux sont présents au catalogue sous un autre nom :
 *   · `Centre du labyrinthe du Minotoror (2)` — suffixe de doublon de saisie ;
 *   · `Comte et Sylargh` / `Klime` / `Nileza` / `Missiz Frizz` et `Harebourg et Frizz` —
 *     variantes **créées en base** par `scripts/fix-double-boss-resolution.ts` ;
 *   · `Donjon du Comte Harebour` — nom **tronqué** en base (il manque le `g`) ;
 *   · `Torkélonia` — le catalogue nomme ce donjon « Sanctuaire de Torkélonia » ;
 *   · `Antre de la Reine Nyée` — le cas spécial de `bossMatchKey` s'applique **avant** le
 *     collage des mots : sur un `cleanName` déjà collé (`antredelareinenyee`) il ne se
 *     déclenche jamais, d'où deux clés différentes.
 *
 * Les correctifs ci-dessous sont **déterministes et bornés** : aucune heuristique, aucun
 * `includes()` sur un mot courant. Les 25 autres donjons sont **réellement absents** du
 * catalogue (siphon à compléter — lot distinct).
 */
const SOVEREIGNTY_ALIASES: Readonly<Record<string, string>> = {
    // Variantes « double boss » (créées en base, même salle que le donjon parent)
    comteetklime: "donjonducomteharebourg",
    comteetmissizfrizz: "donjonducomteharebourg",
    comteetnileza: "donjonducomteharebourg",
    comteetsylargh: "donjonducomteharebourg",
    harebourgetfrizz: "donjonducomteharebourg",
    // Nom tronqué en base (« Harebour » sans `g`)
    donjonducomteharebour: "donjonducomteharebourg",
    // Le catalogue nomme ce donjon « Sanctuaire de Torkélonia »
    torkelonia: "sanctuairedetorkelonia",
    // Cas spécial de `bossMatchKey` réduit au seul mot-clé : on le ramène au nom complet
    reinenyee: "antredelareinenyee",
};

export function bossSovereigntyKey(value: string | null | undefined): string {
    // Suffixe de doublon de saisie (« … Minotoror (2) ») : il n'a pas de sens côté catalogue.
    const withoutDuplicateSuffix = String(value ?? "").replace(/\s*\(\d+\)\s*$/, "");
    const collapsed = bossMatchKey(withoutDuplicateSuffix).replace(/[^a-z0-9]/g, "");
    return SOVEREIGNTY_ALIASES[collapsed] ?? collapsed;
}

export interface BossSovereigntyGap {
    dungeonName: string;
    bossName: string;
}

export interface BossSovereigntyCensus {
    /** Donjons connus en base. */
    databaseCount: number;
    /** Donjons portés par le catalogue local. */
    localCount: number;
    /** Donjons de la base **couverts** par le catalogue. */
    matchedCount: number;
    /** Couverture en pourcentage (0–100), `null` si la base est vide. */
    coveragePct: number | null;
    /** Donjons **sans données locales** (liste bornée par `limit`). */
    missing: BossSovereigntyGap[];
    /** Nombre réel de donjons sans données locales (même si la liste est bornée). */
    missingTotal: number;
}

/**
 * Recense les donjons de la base absents du catalogue local.
 *
 * `limit` borne la liste rendue (défaut 50) — `missingTotal` garde le compte réel : une
 * perte n'est jamais silencieuse. Les clés suivent `bossMatchKey` (même règle que le
 * dry-run des fiches : accents, casse et cas particuliers déjà tranchés).
 */
export function censusBossSovereignty(
    databaseDungeons: readonly { name: string; bossName?: string | null }[],
    localDungeons: readonly { name: string; cleanName?: string | null }[],
    limit = 50
): BossSovereigntyCensus {
    const cappedLimit = Math.max(1, Math.min(500, Math.floor(limit) || 50));

    const localKeys = new Set<string>();
    for (const dungeon of localDungeons) {
        const key = bossSovereigntyKey(dungeon.cleanName || dungeon.name);
        if (key) localKeys.add(key);
    }

    const missing: BossSovereigntyGap[] = [];
    let matchedCount = 0;

    for (const dungeon of databaseDungeons) {
        const key = bossSovereigntyKey(dungeon.name);
        if (key && localKeys.has(key)) {
            matchedCount += 1;
            continue;
        }
        if (missing.length < cappedLimit) {
            missing.push({
                dungeonName: dungeon.name,
                bossName: dungeon.bossName || dungeon.name,
            });
        }
    }

    const databaseCount = databaseDungeons.length;
    return {
        databaseCount,
        localCount: localDungeons.length,
        matchedCount,
        coveragePct: databaseCount > 0 ? Math.round((matchedCount / databaseCount) * 100) : null,
        missing,
        missingTotal: databaseCount - matchedCount,
    };
}