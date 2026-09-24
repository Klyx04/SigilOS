import type { RushMilestone, RushSequence, RushActivityTag } from "@/types/rush-guide-types";
import { getJob } from "@/lib/dofus-assets";
const LOCAL_ASSET_PREFIXES = ["/uploads/assets-dofus/", "/assets-dofus/"];

/**
 * 🛡️ Résolution locale-first des images d'items (comme ItemSearchPanel).
 *
 * Priorité (autonomie) :
 * 1. Chemin local déjà fourni (WebP siphonné) -> servi en STATIQUE direct
 *    (0 appel proxy, 0 dépendance DofusDB).
 * 2. `id` numérique connu -> on tente directement le WebP local siphonné
 *    `/uploads/assets-dofus/items/{id}.webp` (indépendant si le fichier existe).
 * 3. `id` non numérique / inconnu -> proxy `/api/assets-dofus/items/{id}` qui
 *    siphonne à la volée depuis DofusDB (fallback).
 * 4. Sinon URL distante telle quelle.
 *
 * Helper PUR (client-safe) partagé overlay + dashboard.
 */
export function resolveItemImage(id?: string | number | null, imageUrl?: string | null): string {
  // 1) Chemin local connu -> statique direct.
  if (imageUrl && LOCAL_ASSET_PREFIXES.some((p) => imageUrl.startsWith(p))) {
    return imageUrl;
  }
  // 2) id numérique -> WebP local siphonné (autonome).
  if (id != null && id !== "" && /^\d+$/.test(String(id))) {
    return `/uploads/assets-dofus/items/${id}.webp`;
  }
  // 3) id non numérique -> proxy (fallback ?url=).
  if (id != null && id !== "") {
    const q = imageUrl ? `?url=${encodeURIComponent(imageUrl)}` : "";
    return `/api/assets-dofus/items/${id}${q}`;
  }
  // 4) URL distante / vide.
  return imageUrl || "";
}

/**
 * URL de secours (proxy) pour une image d'item — à utiliser comme `onError` /
 * fallback quand `resolveItemImage` pointe vers un WebP local absent. Le proxy
 * `/api/assets-dofus/items/{id}` sert le WebP localisé ou le siphonne à la
 * volée depuis DofusDB (auto-healing), puis renvoie un placeholder (jamais 404).
 */
export function getItemImageFallback(id?: string | number | null, imageUrl?: string | null): string {
  if (id != null && id !== "") {
    // On ne passe jamais un chemin local comme source distante (ce n'est pas un URL).
    const remote = imageUrl && !imageUrl.startsWith("/") ? imageUrl : null;
    const q = remote ? `?url=${encodeURIComponent(remote)}` : "";
    return `/api/assets-dofus/items/${id}${q}`;
  }
  return imageUrl || "";
}

/**
 * Métadonnées graphiques des tags d'activité Rush Sylvestre.
 *
 * Pictos : ce sont les pictos RÉELS du jeu (art Ankama coloré), importés par
 * `refonte-guide-sylvestre/import-dofus-pictos.mjs` vers
 * `public/assets/dofus-ui/pictos/`. Les masques blancs de `icons_assets_*` sont
 * volontairement écartés : invisibles en thème clair. `imagePath` est la source
 * unique — vue publique, overlay et GOD le lisent ici.
 */
export const RUSH_ACTIVITY_TAG_CONFIG: Record<
  string,
  { label: string; color: string; imagePath: string }
> = {
  combat_tactique: {
    label: "Combat Tactique",
    color: "#ef4444",
    imagePath: "/assets/dofus-ui/pictos/combat-tactique.png",
  },
  combat_vagues: {
    label: "Combat à vagues",
    color: "#3b82f6",
    imagePath: "/assets/dofus-ui/pictos/combat-vagues.png",
  },
  songes: {
    label: "Songes",
    color: "#8b5cf6",
    imagePath: "/assets/dofus-ui/pictos/songes.png",
  },
  combat_solo: {
    label: "Combat Solo",
    color: "#f43f5e",
    imagePath: "/assets/dofus-ui/pictos/combat-solo.png",
  },
  combat_plusieurs: {
    label: "Combat à plusieurs",
    color: "#a855f7",
    imagePath: "/assets/dofus-ui/pictos/combat-plusieurs.png",
  },
  plusieurs_personnes: {
    label: "Multi joueurs",
    color: "#10b981",
    imagePath: "/assets/dofus-ui/pictos/plusieurs-personnes.png",
  },
  contrainte_horaire: {
    label: "Horaire Spécifique",
    color: "#f59e0b",
    imagePath: "/assets/dofus-ui/pictos/contrainte-horaire.png",
  },
  donjon: {
    label: "Donjon requis",
    color: "#3b82f6",
    imagePath: "/assets/dofus-ui/pictos/donjon.png",
  },
  sort: {
    label: "Sort requis",
    color: "#ec4899",
    imagePath: "/assets/dofus-ui/pictos/sort.png",
  },
  metier: {
    label: "Métier requis",
    color: "#eab308",
    imagePath: "/assets/dofus-ui/pictos/metier.png",
  },
  quest_group: {
    label: "À faire ensemble",
    color: "#f59e0b",
    imagePath: "/assets/dofus-ui/pictos/plusieurs-personnes.png",
  },
  solver: {
    label: "Solver",
    color: "#10b981",
    imagePath: "/assets/icons/dofusdb.png",
  },
};

/**
 * Normalise le chemin d'icône pour un métier donné.
 * Les pictos de métier (art Ankama 64×64, un par profession) vivent dans
 * `public/assets/rush-sylvestre/` ; sans nom, on retombe sur le picto générique
 * « professions » du référentiel partagé (haches croisées), pas sur un métier
 * particulier.
 */
export function getMetierIconPath(metierName?: string): string {
  if (!metierName) return RUSH_ACTIVITY_TAG_CONFIG.metier.imagePath;
  const normalized = metierName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .trim();
  return `/assets/rush-sylvestre/${normalized}.png`;
}

/**
 * Métiers requis AGRÉGÉS sur tout le guide (tags `metier` de toutes les séquences),
 * dédupliqués par id canonique, avec le niveau max rencontré.
 * Utilisé par le GOD (aperçu) et la modale de lancement (détection).
 */
export function getGuideMetiersRequires(
  milestones: RushMilestone[]
): { id: string; name: string; level: number }[] {
  const seen = new Map<string, { id: string; name: string; level: number }>();
  for (const ms of milestones) {
    for (const seq of ms.sequences) {
      for (const tag of (seq.activityTags || []) as RushActivityTag[]) {
        if (tag.type !== "metier" || !tag.name) continue;
        const job = getJob(tag.name);
        const id = job?.id || tag.name.trim().toLowerCase();
        const name = job?.name || tag.name;
        const level = typeof tag.level === "number" ? tag.level : 200;
        const cur = seen.get(id);
        if (!cur || level > cur.level) seen.set(id, { id, name, level });
      }
    }
  }
  return [...seen.values()];
}

/**
 * Détecte si une séquence est purement informative (non cochable, pas de progression)
 *
 * Le paramètre est **structurel** (le seul champ lu est `activityTags`) : les surfaces
 * partagent la règle mais pas leurs types de séquence (le rail `RushChapterSidebar` et
 * `RushTimelineClient` portent leur propre copie du type, sans `order`). Une signature
 * `RushSequence` obligerait ces appelants à caster — la règle doit rester la même pour
 * toutes les surfaces, sans cast.
 */
export function isInfoSequence(
  seq: { activityTags?: ReadonlyArray<{ type?: string | null }> | null } | null | undefined
): boolean {
  if (!seq) return false;
  if (!Array.isArray(seq.activityTags)) return false;
  return seq.activityTags.some((tag) => tag.type === "info_sequence");
}

/** Les trois types de blocs qui ne sont PAS des étapes : rien à cocher, pas de « n/N ». */
export const NON_CHECKABLE_BLOCK_TYPES = ["SEPARATEUR", "INFO", "DOFUS_OBTAINED"] as const;

/**
 * Un bloc qui n'est pas une étape : séparateur, encart CONSEIL/TIPS, « Dofus obtenu ».
 * Il n'a **aucune progression** — donc il ne peut jamais être « fait », ni être sauté
 * comme tel par une navigation, ni compter dans une numérotation de chapitres.
 *
 * SOURCE UNIQUE : la même règle pilote le selecteur d'étapes de l'overlay, son
 * `defaultMsIndex`, son `goToNextMs` et sa numérotation de chapitres.
 */
export function isNonCheckableBlock(
  ms: Pick<RushMilestone, "type"> | null | undefined
): boolean {
  if (!ms) return false;
  return (NON_CHECKABLE_BLOCK_TYPES as readonly string[]).includes(ms.type || "");
}

/**
 * Position d'un bloc dans la numérotation des CHAPITRES (les blocs non cochables ne
 * sont pas numérotés : sinon « Chapitre 12 / 45 » compterait des bandeaux).
 *
 * @returns `index` = rang 1-based du bloc s'il est cochable, `0` sinon ; `total` = nombre
 *          de chapitres (blocs cochables) du guide.
 */
export function rushChapterPosition(
  blocks: Array<Pick<RushMilestone, "id" | "type">>,
  msId: string | null | undefined
): { index: number; total: number } {
  const chapters = blocks.filter((b) => !isNonCheckableBlock(b));
  const total = chapters.length;
  if (!msId) return { index: 0, total };
  const idx = chapters.findIndex((b) => b.id === msId);
  return { index: idx >= 0 ? idx + 1 : 0, total };
}

/**
 * Extrait la coordonnée d'une séquence (pos_tag > titre > tips > note).
 * Ordre de priorité aligné sur l'édition GOD : le tag technique `pos_tags`
 * (saisi « x, y ; … ») est la source de vérité, puis on retombe sur le titre,
 * les tips et la note (qui peuvent contenir « [x, y] »).
 */
export function getSequenceCoord(seq: RushSequence | null | undefined) {
  if (!seq) return null;
  const posTag = (seq.activityTags || []).find((t) => t.type === "pos_tags");
  const posStr = posTag?.name ? String(posTag.name) : null;
  return parseCoordinates(posStr || "") ||
    parseCoordinates(seq.subGuideName || "") ||
    parseCoordinates(seq.tips || "") ||
    parseCoordinates(seq.note || "") ||
    null;
}

/**
 * Analyse et extrait les coordonnées Dofus d'un texte.
 *
 * Formes reconnues (dans cet ordre) :
 *   1. canonique `[x, y]` / `[x, y, worldId]` — c'est la forme AFFICHÉE (`raw`) ;
 *   2. commande de déplacement écrite dans le texte : `/w x,y` (Dofus actuel) ou
 *      `/travel x,y` (ancienne forme, toujours reconnue à la saisie) ;
 *   3. « pos_tags » saisi au GOD sans crochets (`x, y ; x2, y2`).
 *
 * `travelCommand` est la commande COPIÉE par le presse-papier : `/w x,y`. SOURCE UNIQUE —
 * aucune surface ne fabrique cette commande à la main.
 */
export function parseCoordinates(
  text: string
): { x: number; y: number; worldId?: number; raw: string; travelCommand: string } | null {
  if (!text) return null;
  // 1) Priorité au format canonique [x, y] / [x, y, worldId] (tips, notes).
  let match = text.match(/\[\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(\d+))?\s*\]/);
  // 2) Commande de déplacement saisie telle quelle dans un texte.
  const cmdMatch = match
    ? null
    : text.match(/\/(?:w|travel)\s+(-?\d+)\s*[,;]?\s*(-?\d+)(?:\s*,\s*(\d+))?(?!\d)/i);
  if (!match && cmdMatch) match = cmdMatch;
  // 3) Repli : format « pos_tags » saisi au GOD (x, y ; x2, y2) sans crochets.
  if (!match) match = text.match(/(-?\d+)\s*,\s*(-?\d+)/);
  if (!match) return null;

  const x = parseInt(match[1], 10);
  const y = parseInt(match[2], 10);
  const worldId = match[3] ? parseInt(match[3], 10) : undefined;
  const travelCommand = worldId !== undefined ? `/w ${x},${y},${worldId}` : `/w ${x},${y}`;

  return {
    x,
    y,
    worldId,
    // Une commande ne s'affiche jamais crue : on rend la position canonique.
    raw: cmdMatch ? `[${x}, ${y}]` : match[0],
    travelCommand,
  };
}

/** Référence vers une quête prérequis d'une autre quête. */
export type RushPrereqRef = { seqId: string; milestoneId: string; name: string };

/** Normalise un nom de ressource (casse, espaces) — base de la clé stable. */
const normResourceName = (name = "") => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Clé STABLE d'une ressource `item` du guide — celle portée par `RushResourceAgg.key`
 * (agrégation) ET stockée par les coches manuelles (base comme navigateur). Une seule
 * définition : une ressource cochée est la MÊME sur toutes les surfaces.
 */
export function rushResourceKey(tag: { id?: string | null; name?: string | null }): string {
  return `id:${tag.id ?? ""}|${normResourceName(tag.name ?? "")}`;
}

/**
 * Retourne les quêtes prérequis d'une séquence (match par nom via tags `prereq_text`).
 * Indépendant de la complétion : sert à afficher/dispatcher les prérequis cliquables.
 */
export function getPrereqRefs(seq: RushSequence | null | undefined, allMilestones: RushMilestone[]): RushPrereqRef[] {
  if (!seq || !Array.isArray(seq.activityTags) || !seq.activityTags.length) return [];
  const prereqNames = seq.activityTags
    .filter((tag) => tag.type === "prereq_text")
    .map((tag) => tag.name?.toLowerCase().trim())
    .filter(Boolean) as string[];
  if (!prereqNames.length) return [];

  const out: RushPrereqRef[] = [];
  for (const candidateMs of allMilestones) {
    if (candidateMs.type === "SEPARATEUR" || candidateMs.type === "INFO") continue;
    for (const candidateSeq of candidateMs.sequences) {
      if (candidateSeq.id === seq.id) continue;
      const candidateName = (candidateSeq.subGuideName || candidateSeq.subGuideRef || "")
        .toLowerCase()
        .trim();
      if (prereqNames.includes(candidateName)) {
        out.push({
          seqId: candidateSeq.id,
          milestoneId: candidateMs.id,
          name: candidateSeq.subGuideName || candidateSeq.subGuideRef || candidateSeq.id,
        });
      }
    }
  }
  return out;
}

/**
 * Helper pur vérifiant si une séquence est bloquée par des prérequis inachevés.
 * Renvoie false si la séquence n'a pas de tag prereq_text OU si tous les prérequis sont terminés.
 */
export function isSequenceBlockedByPrereqs(
  seq: RushSequence,
  allCompletedSeqIds: Set<string>,
  allMilestones: RushMilestone[]
): boolean {
  if (!seq || !Array.isArray(seq.activityTags) || !seq.activityTags.length) {
    return false;
  }

  const prereqNames = seq.activityTags
    .filter((tag) => tag.type === "prereq_text")
    .map((tag) => tag.name?.toLowerCase().trim())
    .filter(Boolean) as string[];

  if (!prereqNames.length) return false;

  return allMilestones.some((candidateMs) => {
    if (candidateMs.type === "SEPARATEUR" || candidateMs.type === "INFO") return false;
    return candidateMs.sequences.some((candidateSeq) => {
      if (candidateSeq.id === seq.id) return false;
      const candidateName = (
        candidateSeq.subGuideName ||
        candidateSeq.subGuideRef ||
        ""
      )
        .toLowerCase()
        .trim();

      // Si le candidat correspond à un prérequis requis ET qu'il n'est PAS complété -> bloqué
      return (
        prereqNames.includes(candidateName) &&
        !allCompletedSeqIds.has(candidateSeq.id)
      );
    });
  });
}

/**
 * Trouve la prochaine séquence actionnable du guide en appliquant la priorité :
 * 1. Bookmark actif non terminé et non bloqué
 * 2. Première séquence non terminée, non-info et non bloquée par un prérequis
 */
export function findNextActionableSequence(
  milestones: RushMilestone[],
  completedSeqIds: Set<string>,
  bookmarkedSeqId?: string | null
): { milestone: RushMilestone; sequence: RushSequence } | null {
  // 1. Si un bookmark est défini
  if (bookmarkedSeqId) {
    for (const milestone of milestones) {
      if (milestone.type === "SEPARATEUR" || milestone.type === "INFO") continue;
      const seq = milestone.sequences.find((s) => s.id === bookmarkedSeqId);
      if (seq && !completedSeqIds.has(seq.id) && !isInfoSequence(seq)) {
        return { milestone, sequence: seq };
      }
    }
  }

  // 2. Sinon, première séquence non terminée et non bloquée
  for (const milestone of milestones) {
    if (milestone.type === "SEPARATEUR" || milestone.type === "INFO") continue;
    for (const sequence of milestone.sequences) {
      if (
        !completedSeqIds.has(sequence.id) &&
        !isInfoSequence(sequence) &&
        !isSequenceBlockedByPrereqs(sequence, completedSeqIds, milestones)
      ) {
        return { milestone, sequence };
      }
    }
  }

  return null;
}

/**
 * Formatage standardisé des libellés de progression avec unités explicites
 */
export function formatProgressLabel(
  completed: number,
  total: number,
  unit: "étapes" | "quêtes" | "jalons" | "blocs" = "étapes"
): string {
  return `${completed} / ${total} ${unit}`;
}

/**
 * Résout l'icône d'une séquence Rush.
 * - Clé preset (ex. "serie-de-quete", "icone-succes", "ocre") → `/assets/icons/<clé>.png`
 * - URL absolue ou chemin relatif (import d'image via upload) → renvoyée telle quelle
 * - Vide/null → null
 */
export function resolveRushSeqIcon(icon?: string | null | undefined): string | null {
  if (!icon) return null;
  const trimmed = icon.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  return `/assets/icons/${trimmed}.png`;
}

/**
 * Blocs qui n'appartiennent à AUCUN chapitre du guide : ils vivent ENTRE les chapitres
 * (séparateur visuel, encart d'information, bannière d'obtention de Dofus). Le studio GOD
 * les range donc hors du tri par chapitre.
 */
export const OUTSIDE_CHAPTER_BLOCK_TYPES = ["SEPARATEUR", "INFO", "DOFUS_OBTAINED"] as const;

/**
 * Où INSÉRER un nouveau bloc dans la liste ordonnée du studio GOD (même règle que le
 * glisser-déposer, appliquée à la création).
 *
 * Motif du correctif (mesuré le 20/09/2026) : un bloc créé arrivait **toujours en fin de
 * guide** (`order = nombre de blocs`) — donc hors de son chapitre et à l'autre bout du
 * scroll, à remonter à la main. On se place désormais :
 *   · bloc hors chapitre (séparateur, encart, bannière) → **à la fin** (il n'a pas de rang
 *     de chapitre à respecter) ;
 *   · bloc d'un chapitre → **après le dernier bloc de ce chapitre** ;
 *   · chapitre encore inexistant → **avant le premier bloc d'un chapitre supérieur** (les
 *     chapitres restent croissants), sinon à la fin.
 *
 * Le tableau reçu doit être **ordonné** (l'appelant passe la liste triée par `order`).
 * Retour : l'index d'insertion (`0` = en tête, `ordered.length` = en fin).
 */
export function findMilestoneInsertIndex(
  ordered: { type?: string | null; chapter?: number | null }[],
  target: { type: string; chapter: number }
): number {
  const isOutside = (type?: string | null) =>
    (OUTSIDE_CHAPTER_BLOCK_TYPES as readonly string[]).includes(String(type ?? ""));

  if (isOutside(target.type)) return ordered.length;

  let lastOfChapter = -1;
  for (let i = 0; i < ordered.length; i++) {
    const ms = ordered[i];
    if (isOutside(ms.type)) continue;
    if ((ms.chapter ?? 0) === target.chapter) lastOfChapter = i;
  }
  if (lastOfChapter >= 0) return lastOfChapter + 1;

  for (let i = 0; i < ordered.length; i++) {
    const ms = ordered[i];
    if (isOutside(ms.type)) continue;
    if ((ms.chapter ?? 0) > target.chapter) return i;
  }
  return ordered.length;
}
