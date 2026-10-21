import type { RushMilestone, RushSequence, RushActivityTag } from "@/types/rush-guide-types";
import { getJob } from "@/lib/dofus-assets";
import { QUEST_TYPE_KEYS, questTypeIconPath, type QuestTypeKey } from "@/lib/quest-type-icon";
import { normalizeAlignmentCamp } from "@/lib/rush-route";
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
 * Picto « Ressources » du jeu — SOURCE UNIQUE des trois surfaces (guide interne,
 * guide public, overlay PiP).
 *
 * Mesure du 08/10/2026 (`sharp`, pixels opaques seulement, sonde `src/temp/`) :
 *  · `/assets/nav/resources.png` = tracé **255,255,255** (blanc pur) ⇒ invisible
 *    en thème clair (guide public + overlay `.light`) : jamais utilisable ici ;
 *  · `/assets/dofus/modules/resources.png` = tracé **121,130,53** + contours
 *    sombres ⇒ lisible en clair ET en sombre. C'est le picto du module
 *    « Ressources » du jeu, déjà utilisé par `RushOverlayHeader`.
 *
 * Demande user du 08/10/2026 : « ajouter la vraie icône ressources et non un
 * placeholder » — le carré Lucide `Package` faisait diverger les trois surfaces.
 */
export const RUSH_RESOURCES_PICTO = "/assets/dofus/modules/resources.png";

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
  const travelCommand = worldId !== undefined ? `/travel ${x} ${y} ${worldId}` : `/travel ${x},${y}`;

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

/**
 * PNJ donneur d'une séquence Rush (tag `npc` {name, npcId, imageUrl} posé en
 * God) — `null` si aucun (jamais d'invention). Source unique des 4 rendus.
 */
export function getSequenceNpc(
  seq: RushSequence | null | undefined,
): { id: number | null; name: string | null; imageUrl: string | null } | null {
  const tag = (seq?.activityTags || []).find((t) => t?.type === "npc") as
    | { name?: unknown; npcId?: unknown; imageUrl?: unknown }
    | undefined;
  if (!tag) return null;
  const name = typeof tag.name === "string" && tag.name.trim() !== "" ? tag.name.trim() : null;
  const rawId = Math.floor(Number(tag.npcId));
  const id = Number.isSafeInteger(rawId) && rawId > 0 ? rawId : null;
  const imageUrl = typeof tag.imageUrl === "string" && tag.imageUrl.trim() !== "" ? tag.imageUrl.trim() : null;
  if (!name && id === null && !imageUrl) return null;
  return { id, name, imageUrl };
}

/**
 * Détour zaap proposé pour une séquence Rush — **choix God explicite**
 * (`pos_tags.allowZaap`, coché dans la section Destination, ou zaap **manuel**
 * `pos_tags.zaapX/zaapY` saisi en God) — jamais deviné :
 * le bouton `/zaap x,y ; /travel x,y` façon DPLN ne s'affiche que pour les
 * positions où le détour vaut le coup (décision éditoriale, pas calculée).
 */
export function isZaapCopyEnabled(seq: RushSequence | null | undefined): boolean {
  const tag = (seq?.activityTags || []).find((t) => t?.type === "pos_tags") as
    | { allowZaap?: unknown; zaapX?: unknown; zaapY?: unknown }
    | undefined;
  if (tag?.allowZaap === true) return true;
  return getSequenceManualZaap(seq) !== null;
}

/**
 * Zaap **manuel** d'une séquence Rush (`pos_tags.zaapX/zaapY` saisis en God) :
 * prioritaire sur le zaap auto le plus proche côté rendus. `null` si non
 * saisi (les rendus retombent alors sur l'auto quand `allowZaap` est coché).
 */
export function getSequenceManualZaap(
  seq: RushSequence | null | undefined,
): { x: number; y: number } | null {
  const tag = (seq?.activityTags || []).find((t) => t?.type === "pos_tags") as
    | { zaapX?: unknown; zaapY?: unknown }
    | undefined;
  const zx = typeof tag?.zaapX === "number" && Number.isSafeInteger(tag.zaapX) ? tag.zaapX : null;
  const zy = typeof tag?.zaapY === "number" && Number.isSafeInteger(tag.zaapY) ? tag.zaapY : null;
  if (zx === null || zy === null) return null;
  return { x: zx, y: zy };
}

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

type PrereqCandidate = {
  seqId: string;
  milestoneId: string;
  /** Libellé affichable (libellé d'origine de la séquence). */
  name: string;
  /** Libellé normalisé (casse + espaces insécables). */
  label: string;
};

/** Index des cibles possibles d'un prérequis : les séquences des VRAIS chapitres. */
function prereqCandidates(allMilestones: RushMilestone[]): PrereqCandidate[] {
  const out: PrereqCandidate[] = [];
  for (const ms of allMilestones) {
    if (ms.type === "SEPARATEUR" || ms.type === "INFO") continue;
    for (const seq of ms.sequences) {
      out.push({
        seqId: seq.id,
        milestoneId: ms.id,
        name: seq.subGuideName || seq.subGuideRef || seq.id,
        label: normPrereqName(seq.subGuideName || seq.subGuideRef),
      });
    }
  }
  return out;
}

/**
 * Résout UN tag `prereq_text` vers sa séquence cible.
 *
 * **L'id d'abord** (T-2c) : un tag qui porte un id ne dépend plus du libellé, donc
 * renommer une quête dans le studio God ne casse plus ses prérequis.
 * **Fail-closed** : un id fourni mais introuvable ⇒ `null` — on ne devine pas par nom
 * (un id périmé doit se voir, pas retomber silencieusement sur un homonyme).
 * Sans id (tags historiques), on garde l'ordre historique : nom exact, puis partiel.
 */
function resolvePrereqTag(
  tag: { id?: string | null; name?: string | null },
  candidates: PrereqCandidate[]
): PrereqCandidate | null {
  const wantedId = (tag.id ?? "").trim();
  if (wantedId) return candidates.find((c) => c.seqId === wantedId) ?? null;

  const wanted = normPrereqName(tag.name);
  if (!wanted) return null;
  return (
    candidates.find((c) => c.label === wanted) ??
    candidates.find((c) => c.label.includes(wanted)) ??
    null
  );
}


/**
 * Retourne les quêtes prérequis d'une séquence (tag `prereq_text`, résolu par **id** puis
 * par libellé). Indépendant de la complétion : sert à afficher/dispatcher les cibles.
 */
export function getPrereqRefs(seq: RushSequence | null | undefined, allMilestones: RushMilestone[]): RushPrereqRef[] {
  if (!seq || !Array.isArray(seq.activityTags) || !seq.activityTags.length) return [];
  const tags = seq.activityTags.filter((tag) => tag.type === "prereq_text");
  if (!tags.length) return [];

  const candidates = prereqCandidates(allMilestones);
  const out: RushPrereqRef[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const hit = resolvePrereqTag(tag, candidates);
    if (!hit || hit.seqId === seq.id || seen.has(hit.seqId)) continue;
    seen.add(hit.seqId);
    out.push({ seqId: hit.seqId, milestoneId: hit.milestoneId, name: hit.name });
  }
  return out;
}

/**
 * Résout la CIBLE d'un prérequis vers la séquence à ouvrir.
 *
 * **T-2c** : le tag `prereq_text` porte désormais un **id** stable (écrit par le studio
 * God). La résolution est donc : **id** d'abord, puis libellé (tags historiques) —
 * nom exact, puis nom partiel. Un id fourni mais introuvable renvoie `null` :
 * on ne devine pas (fail-closed), sinon un id périmé viserait un homonyme.
 *
 * Fonction PURE (exportée pour les tests) : `null` quand rien ne correspond.
 */
export function resolvePrereqTarget(
  name: string | null | undefined,
  allMilestones: RushMilestone[],
  id?: string | null
): { seqId: string; milestoneId: string } | null {
  const hit = resolvePrereqTag({ id, name }, prereqCandidates(allMilestones));
  return hit ? { seqId: hit.seqId, milestoneId: hit.milestoneId } : null;
}

/** Normalisation d'un libellé de prérequis : espaces (dont insécables), casse. */
function normPrereqName(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim().toLowerCase();
}

/**
 * Helper pur vérifiant si une séquence est bloquée par des prérequis inachevés.
 * Renvoie false si la séquence n'a pas de tag prereq_text OU si tous les prérequis sont terminés.
 */
/** Camp d'alignement d'une séquence : `alignReq` d'abord, sinon le tag `alignment_set`. */
function alignmentCampOf(seq: RushSequence): string | null {
  const raw = (seq.alignReq ?? "").trim();
  if (raw) return raw;
  const tags = Array.isArray(seq.activityTags) ? seq.activityTags : [];
  const tag = tags.find((t) => t.type === "alignment_set") as { name?: string } | undefined;
  return tag?.name ?? null;
}

/**
 * **Compteur** de quêtes d'alignement validées pour une cité.
 *
 * C'est lui qui remplace la « tranche » : il se met à jour en cochant, sans aucune
 * saisie. Les quêtes d'Ordre au palier N exigent `count >= N` (20/40/60/80/100).
 */
export function alignmentCountForCamp(
  allMilestones: RushMilestone[],
  completedSeqIds: Set<string>,
  camp: string | null | undefined
): number {
  const wanted = normalizeAlignmentCamp(camp);
  if (!wanted) return 0;
  let count = 0;
  for (const ms of allMilestones) {
    for (const seq of ms.sequences || []) {
      if (!completedSeqIds.has(seq.id)) continue;
      if (normalizeAlignmentCamp(alignmentCampOf(seq)) === wanted) count += 1;
    }
  }
  return count;
}

export function isSequenceBlockedByPrereqs(
  seq: RushSequence,
  allCompletedSeqIds: Set<string>,
  allMilestones: RushMilestone[]
): boolean {
  if (!seq) return false;

  // 1. Verrou de palier : une quête d'Ordre au palier N exige N quêtes de cité
  //    validées. Il est vérifié AVANT les tags : une quête d'Ordre n'en porte pas.
  const levelReq = seq.alignLevelReq ?? 0;
  if (levelReq > 0) {
    const count = alignmentCountForCamp(allMilestones, allCompletedSeqIds, alignmentCampOf(seq));
    if (count < levelReq) return true;
  }

  // 2. Prérequis explicites (`prereq_text`).
  const tags = Array.isArray(seq.activityTags)
    ? seq.activityTags.filter((tag) => tag.type === "prereq_text")
    : [];
  if (!tags.length) return false;

  const candidates = prereqCandidates(allMilestones);
  for (const tag of tags) {
    const hit = resolvePrereqTag(tag, candidates);
    if (!hit || hit.seqId === seq.id) continue;
    // Cible connue et non cochée ⇒ bloqué. Un prérequis introuvable ne bloque pas :
    // il est signalé dans le studio, il ne peut pas verrouiller une quête à vie.
    if (!allCompletedSeqIds.has(hit.seqId)) return true;
  }
  return false;
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
 * - Clé de type de quête (`principale`, `repetable-event`, … — `QUEST_TYPE_KEYS`)
 *   → sprite siphonné du client (`questTypeIconPath`, `src/lib/quest-type-icon.ts`).
 * - Clé preset (ex. "serie-de-quete", "icone-succes", "ocre") → `/assets/icons/<clé>.png`
 * - URL absolue ou chemin relatif (import d'image via upload) → renvoyée telle quelle
 * - Vide/null → null
 */
export function resolveRushSeqIcon(icon?: string | null | undefined): string | null {
  if (!icon) return null;
  const trimmed = icon.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  if ((QUEST_TYPE_KEYS as readonly string[]).includes(trimmed)) {
    return questTypeIconPath(trimmed as QuestTypeKey);
  }
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

/**
 * **Cascade de réinitialisation** d'un changement de cité.
 *
 * En jeu, refaire son alignement invalide aussi les quêtes qui **dépendent** d'une
 * quête d'alignement (prérequis), puis celles qui dépendent de celles-ci, etc.
 * On calcule la **fermeture transitive** du graphe de prérequis à partir des graines.
 *
 * Fonction PURE : aucun accès base, aucune mutation. Les cycles sont absorbés.
 */
export function cascadeResetIds(
  allMilestones: RushMilestone[],
  seedIds: Iterable<string>
): Set<string> {
  const toReset = new Set(seedIds);
  if (toReset.size === 0) return toReset;

  let grew = true;
  while (grew) {
    grew = false;
    for (const ms of allMilestones) {
      for (const seq of ms.sequences || []) {
        if (toReset.has(seq.id)) continue;
        const refs = getPrereqRefs(seq, allMilestones);
        if (refs.some((ref) => toReset.has(ref.seqId))) {
          toReset.add(seq.id);
          grew = true;
        }
      }
    }
  }
  return toReset;
}

/**
 * **S0-7 (surfaces locales) — décocher un donjon dévalide la quête.**
 *
 * Le guide public et l'overlay invité n'ont pas de serveur pour corriger l'état : c'est
 * la surface qui doit retirer la quête de ses étapes cochées. Règle pure, une seule fois
 * pour les deux surfaces (aucune copie), et sans mutation des entrées.
 *
 * Le bloc redevient « non terminé » dès qu'une de ses quêtes cochables manque — les
 * encarts informatifs (`info_sequence`) ne comptent jamais comme une étape à cocher.
 */
export function deselectSequenceFromProgress(input: {
  completedStepsByMs: Map<string, Set<string>>;
  completedIds: Set<string>;
  milestones: Array<{ id: string; sequences?: Array<{ id: string; activityTags?: unknown }> }>;
  sequenceId: string;
}): {
  completedStepsByMs: Map<string, Set<string>>;
  completedIds: Set<string>;
  /** Bloc propriétaire de la quête (`null` si la quête n'est pas dans le guide). */
  milestoneId: string | null;
  /** `false` = rien à faire (quête inconnue ou déjà décochée). */
  changed: boolean;
} {
  const { completedStepsByMs, completedIds, milestones, sequenceId } = input;

  const owner = milestones.find((m) => (m.sequences ?? []).some((s) => s.id === sequenceId));
  if (!owner) {
    return { completedStepsByMs, completedIds, milestoneId: null, changed: false };
  }

  const steps = new Set(completedStepsByMs.get(owner.id) ?? []);
  if (!steps.has(sequenceId)) {
    return { completedStepsByMs, completedIds, milestoneId: owner.id, changed: false };
  }

  steps.delete(sequenceId);
  const nextSteps = new Map(completedStepsByMs);
  nextSteps.set(owner.id, steps);

  const contentIds = (owner.sequences ?? [])
    .filter((s) => !isInfoSequence(s as { activityTags?: Array<{ type?: string | null }> }))
    .map((s) => s.id);
  const allDone = contentIds.length > 0 && contentIds.every((id) => steps.has(id));

  const nextIds = new Set(completedIds);
  if (allDone) nextIds.add(owner.id);
  else nextIds.delete(owner.id);

  return {
    completedStepsByMs: nextSteps,
    completedIds: nextIds,
    milestoneId: owner.id,
    changed: true,
  };
}

