/**
 * Quête Ocre (Éternelle Moisson) — règles PURES partagées.
 *
 * Aucun import React, aucun I/O, aucun appel réseau : ce module ne fait que
 * répondre à trois questions, avec la MÊME règle que le dashboard (`getMyOcreProgress`) :
 *
 *   1. Quelles cibles me restent-elles à capturer ? (`isOcreMonsterNeeded`)
 *   2. Quelle pierre d'âme faut-il pour chacune ? (`soulStoneForLevel`)
 *   3. Combien de pierres de chaque palier faut-il prévoir ? (`buildOcrePlan`)
 *
 * SOURCES DES SEUILS DE PIERRES (mesurés, jamais inventés — API DofusDB, articles
 * 9686 → 9690, effet « capture d'âme » : 50 / 100 / 150 / 190 / 1000) :
 *   • 9686 Petite pierre d'âme        — monstres ≤ 50
 *   • 9687 Moyenne pierre d'âme       — monstres ≤ 100
 *   • 9688 Grande pierre d'âme        — monstres ≤ 150
 *   • 9689 Énorme pierre d'âme        — monstres ≤ 190
 *   • 9690 Gigantesque pierre d'âme   — au-delà (en pratique : 191 → 200)
 *
 * IMAGES — 100 % locales (aucune dépendance DofusDB à l'exécution) :
 *   • pierres   : `/uploads/assets-dofus/items/<id>.webp` (WebP siphonnés, présents)
 *   • monstres  : `/uploads/assets-dofus/monsters/<id>.webp` (WebP siphonnés)
 *   • repli     : nos pictos du jeu (`/assets/dofus/icons/…`) — jamais une URL distante.
 */

// -----------------------------------------------------------------------------
// TYPES (shape « lite » : ce qui voyage de la page vers l'overlay, sérialisable)
// -----------------------------------------------------------------------------

/** Monstre de la quête Ocre tel qu'il circule dans l'overlay (aucun Date, aucun objet lourd). */
export interface OcreMonsterLite {
  id: number;
  nameFr: string;
  /** `archimonstre` | `boss` | `monstre` (les monstres simples sont exclus en amont). */
  type: string;
  owned: number;
  /** `MANQUANT` | `POSSEDE` | `DOUBLON` */
  state: string;
  levelMin?: number | null;
  levelMax?: number | null;
  /** Étape de quête qui exige ce monstre (permet de savoir s'il est encore utile). */
  step?: number | null;
  zone?: string | null;
  subzone?: string | null;
}

/** Données de la quête Ocre utiles à l'overlay (mêmes chiffres que le dashboard). */
export interface OcrePanelData {
  monsters: OcreMonsterLite[];
  currentStep: number;
  totalSteps: number;
  characterName?: string | null;
  serverName?: string | null;
  /**
   * Nombre de copies nécessaires pour valider une cible (`parallelQuests` Metamob, ≥ 1).
   * Sert aux pas « +1 » : le premier `+` déclare exactement ce qu'il faut.
   */
  parallelQuests?: number;
  /** Pseudo Metamob du membre → lien vers son profil. Absent ⇒ aucun lien. */
  pseudo?: string | null;
  /** Dernière synchro Metamob (ISO) — jamais un `Date` (payload sérialisé). */
  lastSync?: string | null;
  /** Vrai quand la réponse vient du snapshot local (Metamob indisponible). */
  isOffline?: boolean;
  /** Vrai quand rien n'a pu être chargé : l'overlay propose de réessayer. */
  unavailable?: boolean;
}

export interface SoulStone {
  id: number;
  name: string;
  /** Palier 1 → 5 (ordre croissant ; l'affichage ne montre que la plage de niveaux). */
  tier: number;
  /** Niveau maximum capturable ; `null` = dernier palier (au-delà du précédent). */
  maxLevel: number | null;
  imageUrl: string;
}

export interface OcreTarget extends OcreMonsterLite {
  /** Niveau de référence pour le choix de la pierre (le plus haut = capture garantie). */
  level: number;
  /** Vrai s'il reste à capturer. */
  needed: boolean;
  /** Pierre d'âme à utiliser pour le capturer. */
  stone: SoulStone;
}

export interface OcreStoneNeed {
  stone: SoulStone;
  count: number;
}

export interface OcrePlan {
  /** Toutes les cibles (archis + boss), manquants d'abord puis par nom. */
  targets: OcreTarget[];
  /** Pierres à prévoir, dans l'ordre des paliers — paliers vides INCLUS (0 = rien à faire). */
  stones: OcreStoneNeed[];
  /** Somme des pierres à prévoir. */
  stoneTotal: number;
  /** Archimonstres / gardiens de donjon : totaux, possédés, restants. */
  archis: { total: number; owned: number; missing: number };
  bosses: { total: number; owned: number; missing: number };
  progress: { total: number; owned: number; missing: number; percent: number };
}

// -----------------------------------------------------------------------------
// IMAGES — TOUTES LOCALES (aucune requête vers DofusDB)
// -----------------------------------------------------------------------------

/** Dossier des WebP de monstres siphonnés chez nous. */
export const OCRE_MONSTER_IMAGE_DIR = "/uploads/assets-dofus/monsters";
/** Dossier des WebP d'items (ici : les pierres d'âme) siphonnés chez nous. */
export const OCRE_ITEM_IMAGE_DIR = "/uploads/assets-dofus/items";

/** Pictos du jeu servant de repli quand le WebP local d'un monstre manque. */
export const OCRE_MONSTER_ICONS: Record<string, string> = {
  archimonstre: "/assets/dofus/icons/archimonster.png",
  boss: "/assets/dofus/icons/boss.png",
  monstre: "/assets/dofus/icons/crossedSwords.png",
};

/** Chemin STATIQUE du WebP local d'un monstre (jamais le proxy qui siphonne). */
export function ocreMonsterImage(id: number): string {
  return `${OCRE_MONSTER_IMAGE_DIR}/${id}.webp`;
}

/** Repli local (picto du jeu) d'une cible — jamais une URL distante. */
export function ocreMonsterIcon(type?: string | null): string {
  return OCRE_MONSTER_ICONS[String(type ?? "").toLowerCase()] ?? OCRE_MONSTER_ICONS.monstre;
}

// -----------------------------------------------------------------------------
// PIERRES D'ÂME
// -----------------------------------------------------------------------------

/** Les 5 pierres d'âme, du plus petit au plus grand palier (source : DofusDB 9686-9690). */
export const SOUL_STONES: readonly SoulStone[] = [
  { id: 9686, name: "Petite pierre d'âme", tier: 1, maxLevel: 50, imageUrl: `${OCRE_ITEM_IMAGE_DIR}/9686.webp` },
  { id: 9687, name: "Moyenne pierre d'âme", tier: 2, maxLevel: 100, imageUrl: `${OCRE_ITEM_IMAGE_DIR}/9687.webp` },
  { id: 9688, name: "Grande pierre d'âme", tier: 3, maxLevel: 150, imageUrl: `${OCRE_ITEM_IMAGE_DIR}/9688.webp` },
  { id: 9689, name: "Énorme pierre d'âme", tier: 4, maxLevel: 190, imageUrl: `${OCRE_ITEM_IMAGE_DIR}/9689.webp` },
  { id: 9690, name: "Gigantesque pierre d'âme", tier: 5, maxLevel: null, imageUrl: `${OCRE_ITEM_IMAGE_DIR}/9690.webp` },
];

/** Libellé de la plage de niveaux couverte (« Niv. ≤ 100 » / « Niv. 191 et + »). */
export function soulStoneLevelLabel(stone: SoulStone): string {
  return stone.maxLevel == null ? "Niv. 191 et +" : `Niv. ≤ ${stone.maxLevel}`;
}

/**
 * Pierre d'âme garantissant la capture d'un monstre de ce niveau.
 * Niveau inconnu (0) → on ne promet rien : on reste sur la plus petite pierre.
 */
export function soulStoneForLevel(level: number): SoulStone {
  const lvl = Number.isFinite(level) ? Math.max(0, Math.trunc(level)) : 0;
  for (const stone of SOUL_STONES) {
    if (stone.maxLevel == null || lvl <= stone.maxLevel) return stone;
  }
  return SOUL_STONES[SOUL_STONES.length - 1];
}

// -----------------------------------------------------------------------------
// CIBLES RESTANTES
// -----------------------------------------------------------------------------

/** Niveau de référence d'un monstre : le plus haut (capture garantie), sinon le plus bas. */
export function ocreMonsterLevel(m: Pick<OcreMonsterLite, "levelMin" | "levelMax">): number {
  const max = Number(m.levelMax ?? 0);
  const min = Number(m.levelMin ?? 0);
  if (max > 0) return max;
  return min > 0 ? min : 0;
}

/**
 * Le monstre est-il encore à capturer ?
 * MÊME règle que `getMyOcreProgress` (source unique de la progression) : un monstre
 * `MANQUANT` dont l'étape est déjà passée ne compte plus (l'étape est derrière nous).
 */
export function isOcreMonsterNeeded(
  m: Pick<OcreMonsterLite, "state" | "step">,
  currentStep?: number | null
): boolean {
  if (m.state !== "MANQUANT") return false;
  const step = Number(m.step ?? 0);
  const current = Number(currentStep ?? 0);
  return !(step > 0 && current > 0 && step < current);
}

/** Les cibles de la quête : archimonstres + gardiens de donjon (jamais les monstres simples). */
export function isOcreTarget(m: Pick<OcreMonsterLite, "type">): boolean {
  const t = String(m.type ?? "").toLowerCase();
  return t === "archimonstre" || t === "boss";
}

// -----------------------------------------------------------------------------
// PLAN COMPLET (cibles + pierres + progression)
// -----------------------------------------------------------------------------

/**
 * Construit le plan affiché par l'overlay : cibles enrichies (niveau, pierre requise,
 * reste-à-faire), besoins en pierres par palier, compteurs archis / gardiens.
 *
 * Les paliers de pierres sont renvoyés ENSEMBLE (même à 0) : l'UI choisit de les masquer
 * ou de les griser — une règle pure ne décide pas de l'affichage.
 */
export function buildOcrePlan(data: Pick<OcrePanelData, "monsters" | "currentStep">): OcrePlan {
  const currentStep = Number(data.currentStep ?? 0);
  const countByStoneId = new Map<number, number>();
  const archis = { total: 0, owned: 0, missing: 0 };
  const bosses = { total: 0, owned: 0, missing: 0 };

  const targets: OcreTarget[] = (data.monsters ?? [])
    .filter(isOcreTarget)
    .map((m) => {
      const level = ocreMonsterLevel(m);
      const needed = isOcreMonsterNeeded(m, currentStep);
      const stone = soulStoneForLevel(level);
      const bucket = String(m.type).toLowerCase() === "boss" ? bosses : archis;
      bucket.total++;
      if (needed) {
        bucket.missing++;
        countByStoneId.set(stone.id, (countByStoneId.get(stone.id) ?? 0) + 1);
      } else {
        bucket.owned++;
      }
      return { ...m, level, needed, stone };
    })
    // Manquants d'abord (l'overlay sert à savoir quoi chasser), puis par nom.
    .sort((a, b) => {
      if (a.needed !== b.needed) return a.needed ? -1 : 1;
      return a.nameFr.localeCompare(b.nameFr, "fr");
    });

  const stones: OcreStoneNeed[] = SOUL_STONES.map((stone) => ({
    stone,
    count: countByStoneId.get(stone.id) ?? 0,
  }));

  const total = archis.total + bosses.total;
  const owned = archis.owned + bosses.owned;
  const missing = archis.missing + bosses.missing;

  return {
    targets,
    stones,
    stoneTotal: stones.reduce((sum, s) => sum + s.count, 0),
    archis,
    bosses,
    progress: { total, owned, missing, percent: total > 0 ? Math.round((owned / total) * 100) : 0 },
  };
}

// -----------------------------------------------------------------------------
// PONT SERVEUR → OVERLAY (mapping unique, aucune duplication page/modale)
// -----------------------------------------------------------------------------

/**
 * Forme minimale acceptée en entrée : c'est un SOUS-ENSEMBLE de `OcreProgressData`
 * (actions serveur). Typé structurellement pour ne rien importer du serveur ici.
 */
export interface OcreProgressSource {
  monsters?: Array<Partial<OcreMonsterLite> & { id: number; nameFr?: string; name?: string }> | null;
  questInfo?: {
    currentStep?: number;
    totalSteps?: number;
    characterName?: string;
    serverName?: string;
    parallelQuests?: number;
  } | null;
  /** Pseudo Metamob (profil) — hors `questInfo` : c'est l'identité du membre. */
  pseudo?: string | null;
  lastSync?: Date | string | null;
  isOffline?: boolean;
}

/** Ne garde que ce que l'overlay affiche : payload court, sérialisable, sans `Date`. */
export function toOcrePanelData(src: OcreProgressSource | null | undefined): OcrePanelData {
  const monsters: OcreMonsterLite[] = (src?.monsters ?? []).map((m) => ({
    id: Number(m.id),
    nameFr: String(m.nameFr || m.name || ""),
    type: String(m.type ?? ""),
    owned: Number(m.owned ?? 0),
    state: String(m.state ?? "MANQUANT"),
    levelMin: Number(m.levelMin ?? 0),
    levelMax: Number(m.levelMax ?? 0),
    step: Number(m.step ?? 0),
    zone: m.zone ?? null,
    subzone: m.subzone ?? null,
  }));

  const lastSync = src?.lastSync instanceof Date
    ? src.lastSync.toISOString()
    : (typeof src?.lastSync === "string" ? src.lastSync : null);

  return {
    monsters,
    currentStep: Number(src?.questInfo?.currentStep ?? 0),
    totalSteps: Number(src?.questInfo?.totalSteps ?? 0),
    characterName: src?.questInfo?.characterName ?? null,
    serverName: src?.questInfo?.serverName ?? null,
    parallelQuests: ocreRequiredCopies({ parallelQuests: src?.questInfo?.parallelQuests }),
    pseudo: src?.pseudo ?? null,
    lastSync,
    isOffline: !!src?.isOffline,
  };
}

// -----------------------------------------------------------------------------
// ÉCRITURE EN DIRECT (validation d'une cible) — règles pures et testables
// -----------------------------------------------------------------------------

/** Copies à posséder pour valider une cible (`parallelQuests` Metamob, au minimum 1). */
export function ocreRequiredCopies(data: Pick<OcrePanelData, "parallelQuests">): number {
  const pq = Number(data?.parallelQuests ?? 1);
  return Number.isFinite(pq) && pq >= 1 ? Math.trunc(pq) : 1;
}

/**
 * État LOCAL d'une cible après une écriture optimiste.
 *
 * ⚠️ MÊME FORMULE que `computeMonsterState` (metamob-client) : elle est recopiée ici
 * parce que le panneau de l'overlay met à jour **de façon optimiste** (retour immédiat)
 * sans embarquer le client Metamob dans son bundle. La **parité des deux fonctions est
 * verrouillée par un test** (`tests/unit/rush-overlay-ocre.test.ts`) : si la règle change
 * côté Metamob, le test casse — jamais de divergence silencieuse.
 */
export function ocreLocalState(owned: number, requiredCopies = 1): string {
  const pq = Number.isFinite(requiredCopies) && requiredCopies >= 1 ? Math.trunc(requiredCopies) : 1;
  const q = Number.isFinite(owned) ? Math.max(0, Math.trunc(owned)) : 0;
  if (q <= 0) return "MANQUANT";
  if (q > pq) return "DOUBLON";
  return "POSSEDE";
}

/**
 * Quantité suivante d'un pas de ±1.
 * Le **premier `+`** déclare exactement ce que la quête demande (`parallelQuests`) :
 * c'est l'action « je l'ai » — ensuite on incrémente (doublons), et `−` redescend.
 */
export function nextOcreQuantity(current: number, delta: 1 | -1, requiredCopies = 1): number {
  const q = Number.isFinite(current) ? Math.max(0, Math.trunc(current)) : 0;
  if (delta < 0) return Math.max(0, q - 1);
  return q <= 0 ? ocreRequiredCopies({ parallelQuests: requiredCopies }) : q + 1;
}

/** Applique une quantité à une cible — retour **immuable** avec l'état recalculé. */
export function applyOcreQuantity(
  monsters: OcreMonsterLite[],
  monsterId: number,
  quantity: number,
  requiredCopies = 1
): OcreMonsterLite[] {
  const q = Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0;
  return monsters.map((m) =>
    m.id === monsterId ? { ...m, owned: q, state: ocreLocalState(q, requiredCopies) } : m
  );
}

/** URL du profil Metamob d'un pseudo (même convention que le reste du dépôt). */
export function metamobProfileUrl(pseudo?: string | null): string | null {
  const clean = String(pseudo ?? "").trim();
  if (!clean) return null;
  return `https://www.metamob.fr/profile/${encodeURIComponent(clean)}`;
}

/**
 * Libellé d'état affiché pour une cible, à partir de ce qui est RÉELLEMENT déclaré :
 *   • rien              → « À capturer »
 *   • copies partielles → « À capturer ×1/2 » (la quête en demande 2)
 *   • complet           → « Possédé ×2 » (au-delà : doublons, toujours « Possédé »)
 *
 * Vocabulaire : on CAPTURE un archimonstre / un gardien (la quête les veut en pierre
 * d'âme), on ne « coche » pas une étape — « À capturer » dit l'action réelle.
 */
export function ocreStateLabel(owned: number, requiredCopies = 1): string {
  const pq = ocreRequiredCopies({ parallelQuests: requiredCopies });
  const q = Number.isFinite(owned) ? Math.max(0, Math.trunc(owned)) : 0;
  if (q <= 0) return "À capturer";
  if (q < pq) return `À capturer ×${q}/${pq}`;
  return `Possédé ×${q}`;
}

/** État « rien de disponible » : l'overlay garde son bouton et propose de réessayer. */
export function unavailableOcrePanelData(): OcrePanelData {
  return { monsters: [], currentStep: 0, totalSteps: 0, unavailable: true };
}
