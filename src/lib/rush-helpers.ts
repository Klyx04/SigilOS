import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { isSequenceBlockedByPrereqs } from "@/lib/rush-guide-utils";

/**
 * rush-helpers.ts — S4 « qui peut aider ».
 *
 * Helpers PURS (client-safe, aucun state / side-effect / requête) qui :
 *  1. extraient d'une séquence Rush ses « besoins d'aide » :
 *     - métier requis (+ niveau)   → tag `activityTags[type="metier"]`
 *     - donjon(s) requis           → `seq.dungeon` / `seq.dungeons` / `dungeonIds`
 *  2. matchent ces besoins contre les profils membres de la guilde
 *     (« X a le métier Façonneur 200 », « X a déjà fait ce donjon »).
 *
 * Découplé de la forme Prisma : le côté serveur alimente `RushHelperProfile`.
 * Supporte le format métier legacy (`string[]` = nom seul, niveau inconnu)
 * ET le format enrichi (`{ name, level }[]`), pour une migration douce.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Entrée métier d'un profil membre : format legacy (nom seul) ou enrichi. */
export type RushHelperMetier = string | { name: string; level?: number };

/** Profil membre simplifié, découplé de la forme Prisma. */
export type RushHelperProfile = {
  profileId: string;
  name?: string;
  avatar?: string;
  classe?: string | null;
  dofusLevel?: number | null;
  /** Alignement courant du membre (bontarien / brakmarien / neutre). */
  alignment?: string | null;
  /** Ordre d'alignement (id de l'ordre, ex. "coeur-vaillant"). */
  alignmentOrder?: string | null;
  /** Niveau / tranche d'alignement (0 à 100). */
  alignmentLevel?: number | null;
  metiers?: RushHelperMetier[];
  /** IDs de donjons validés par le membre (UserDungeonProgress.dungeonId). */
  completedDungeonIds?: string[];
  /** Noms de donjons validés (fallback si jointure uniquement par nom). */
  completedDungeonNames?: string[];
};

/** Métier requis par une séquence (nom + niveau optionnel). */
export type RushMetierNeed = { name: string; level?: number };

/** Donjon requis par une séquence (id + nom). */
export type RushDungeonNeed = { id?: string; name: string };

/** Alignement requis par une séquence (nom de camp + niveau/tranche). */
export type RushAlignmentNeed = { alignment: string; level?: number };

/** Résultat de match pour un besoin métier. */
export type RushMetierMatch = {
  profile: RushHelperProfile;
  metier: string;
  requiredLevel?: number;
  memberLevel?: number;
  can: boolean;
  /** true si le niveau membre est inconnu (indéterminé → « à confirmer »). */
  levelUnknown: boolean;
};

/** Résultat de match pour un besoin donjon. */
export type RushDungeonMatch = {
  profile: RushHelperProfile;
  dungeonId?: string;
  dungeonName: string;
  can: boolean;
};

/** Résultat de match pour un besoin d'alignement. */
export type RushAlignmentMatch = {
  profile: RushHelperProfile;
  alignment: string;
  requiredLevel?: number;
  memberLevel?: number;
  can: boolean;
  /** true si le niveau/tranche du membre est inconnu (indéterminé → « à confirmer »). */
  levelUnknown: boolean;
};

/** Résultat agrégé pour une séquence. */
export type RushSequenceHelpers = {
  metierHelpers: RushMetierMatch[];
  dungeonHelpers: RushDungeonMatch[];
  alignmentHelpers: RushAlignmentMatch[];
  /** Union des membres aidants (dédupliqués par profileId) + motifs lisibles. */
  helpers: { profile: RushHelperProfile; reasons: string[] }[];
  /** Membres dont le niveau/tranche est INCONNU (métier/alignement requis) → « à confirmer ». */
  uncertainHelpers: { profile: RushHelperProfile; reasons: string[] }[];
};

// ─── Normalisation (comparaison insensible casse/accents) ───────────────────

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .trim();
}

function metierName(entry: RushHelperMetier): string {
  return typeof entry === "string" ? entry : entry.name || "";
}

function metierLevel(entry: RushHelperMetier): number | undefined {
  return typeof entry === "string" ? undefined : entry.level;
}

// ─── Extraction des besoins ─────────────────────────────────────────────────

/** Métiers requis par une séquence (tags `metier`). */
export function getRequiredMetiers(seq: RushSequence | null | undefined): RushMetierNeed[] {
  if (!seq || !Array.isArray(seq.activityTags)) return [];
  return seq.activityTags
    .filter((t) => t.type === "metier" && t.name)
    .map((t) => ({ name: t.name as string, level: t.level }));
}

/** Donjons requis par une séquence (réf structurée puis fallback tags). */
export function getRequiredDungeons(seq: RushSequence | null | undefined): RushDungeonNeed[] {
  if (!seq) return [];
  const out: RushDungeonNeed[] = [];
  const seen = new Set<string>();
  const push = (id: string | undefined, name: string | undefined) => {
    if (!name) return;
    const key = normalizeName(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id, name });
  };

  if (seq.dungeon) push(seq.dungeon.id, seq.dungeon.name);
  if (Array.isArray(seq.dungeons)) {
    for (const d of seq.dungeons) push(d.id, d.name);
  }
  // Fallback : tags donjon / ocre_dungeon portant un nom, si aucune réf structurée.
  if (out.length === 0 && Array.isArray(seq.activityTags)) {
    for (const t of seq.activityTags) {
      if ((t.type === "donjon" || t.type === "ocre_dungeon") && t.name) {
        push(t.name, t.name);
      }
    }
  }
  return out;
}

/** Alignement requis par une séquence (champs `alignReq` / `alignOrderReq`). */
export function getRequiredAlignment(
  seq: RushSequence | null | undefined
): RushAlignmentNeed | null {
  if (!seq || !seq.alignReq) return null;
  return { alignment: seq.alignReq, level: seq.alignOrderReq ?? undefined };
}

/** Camp + niveau défini par une quête d'alignement (tag `alignment_set`). */
export type RushAlignmentSet = { camp: string; level: number };

/**
 * Lit le tag `alignment_set` d'une séquence : la quête « donne » cet alignement
 * (camp + niveau) quand elle est cochée. Retourne null si la séquence n'est pas
 * une quête d'alignement.
 */
export function getAlignmentSet(
  seq: RushSequence | null | undefined
): RushAlignmentSet | null {
  if (!seq || !Array.isArray(seq.activityTags)) return null;
  const tag = seq.activityTags.find((t) => t.type === "alignment_set");
  if (!tag || !tag.name) return null;
  return {
    camp: tag.name,
    level: typeof tag.level === "number" ? Math.max(0, Math.min(100, tag.level)) : 0,
  };
}

/**
 * Cascade décoche : quand on décoche `targetSeqId`, on décoche aussi TOUTES les
 * quêtes qui en dépendent (directement ou transitivement via `prereq_text`).
 * Retourne l'ensemble des ids de séquences à décocher (incluant la cible).
 * Point fixe : tant qu'une quête cochée redevient « bloquée », on la décoche.
 */
export function collectCascadeUncheck(
  targetSeqId: string,
  milestones: RushMilestone[],
  allCompletedSeqIds: Set<string>
): Set<string> {
  const completed = new Set(allCompletedSeqIds);
  completed.delete(targetSeqId);
  const cascade = new Set<string>([targetSeqId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const ms of milestones) {
      if (!ms || ms.type === "SEPARATEUR" || ms.type === "INFO" || ms.type === "DOFUS_OBTAINED") continue;
      for (const seq of ms.sequences) {
        if (!seq || cascade.has(seq.id) || !completed.has(seq.id)) continue;
        if (isSequenceBlockedByPrereqs(seq, completed, milestones)) {
          completed.delete(seq.id);
          cascade.add(seq.id);
          changed = true;
        }
      }
    }
  }
  return cascade;
}

// ─── Match unitaires ────────────────────────────────────────────────────────

/** Match d'un besoin métier contre UN membre. */
export function matchMetier(need: RushMetierNeed, member: RushHelperProfile): RushMetierMatch {
  const base: RushMetierMatch = {
    profile: member,
    metier: need.name,
    requiredLevel: need.level,
    memberLevel: undefined,
    can: false,
    levelUnknown: false,
  };
  const entry = (Array.isArray(member.metiers) ? member.metiers : []).find(
    (e) => normalizeName(metierName(e)) === normalizeName(need.name)
  );
  if (!entry) return base;

  const ml = metierLevel(entry);
  base.memberLevel = ml;
  if (need.level == null) {
    return { ...base, can: true };
  }
  if (ml == null) {
    // Niveau requis mais niveau membre inconnu → indéterminé (« à confirmer »).
    return { ...base, levelUnknown: true };
  }
  return { ...base, can: ml >= need.level };
}

/** Match d'un besoin donjon contre UN membre (par id, sinon par nom). */
export function matchDungeon(need: RushDungeonNeed, member: RushHelperProfile): RushDungeonMatch {
  const byId = !!need.id && (member.completedDungeonIds || []).includes(need.id);
  const byName =
    (member.completedDungeonNames || []).some(
      (n) => normalizeName(n) === normalizeName(need.name)
    ) ?? false;
  return { profile: member, dungeonId: need.id, dungeonName: need.name, can: byId || byName };
}

/** Match d'un besoin d'alignement contre UN membre (camp + niveau/tranche). */
export function matchAlignment(
  need: RushAlignmentNeed,
  member: RushHelperProfile
): RushAlignmentMatch {
  const base: RushAlignmentMatch = {
    profile: member,
    alignment: need.alignment,
    requiredLevel: need.level,
    memberLevel: member.alignmentLevel ?? undefined,
    can: false,
    levelUnknown: false,
  };
  // Le camp doit correspondre (insensible casse/accents).
  if (normalizeName(member.alignment || "") !== normalizeName(need.alignment)) {
    return base;
  }
  if (need.level == null) {
    return { ...base, can: true };
  }
  if (member.alignmentLevel == null) {
    // Niveau requis mais tranche inconnue → indéterminé (« à confirmer »).
    return { ...base, levelUnknown: true };
  }
  return { ...base, can: member.alignmentLevel >= need.level };
}

// ─── Match agrégé pour une séquence ─────────────────────────────────────────

/**
 * Retourne, pour une séquence, les membres capables d'aider sur au moins un
 * besoin (métier + niveau requis / donjon requis), avec les motifs lisibles.
 */
export function findSequenceHelpers(
  seq: RushSequence | null | undefined,
  members: RushHelperProfile[]
): RushSequenceHelpers {
  const metierNeeds = getRequiredMetiers(seq);
  const dungeonNeeds = getRequiredDungeons(seq);
  const alignmentNeed = getRequiredAlignment(seq);

  const metierHelpers: RushMetierMatch[] = [];
  const dungeonHelpers: RushDungeonMatch[] = [];
  const alignmentHelpers: RushAlignmentMatch[] = [];
  for (const need of metierNeeds) {
    for (const m of members) {
      const r = matchMetier(need, m);
      if (r.can) metierHelpers.push(r);
    }
  }
  for (const need of dungeonNeeds) {
    for (const m of members) {
      const r = matchDungeon(need, m);
      if (r.can) dungeonHelpers.push(r);
    }
  }
  if (alignmentNeed) {
    for (const m of members) {
      const r = matchAlignment(alignmentNeed, m);
      if (r.can) alignmentHelpers.push(r);
    }
  }

  const pushReason = (map: Map<string, string[]>, profileId: string, reason: string) => {
    const list = map.get(profileId) || [];
    if (!list.includes(reason)) {
      list.push(reason);
      map.set(profileId, list);
    }
  };

  const reasons = new Map<string, string[]>();
  for (const r of metierHelpers) {
    pushReason(
      reasons,
      r.profile.profileId,
      r.requiredLevel ? `Métier ${r.metier} ${r.requiredLevel}` : `Métier ${r.metier}`
    );
  }
  for (const r of dungeonHelpers) {
    pushReason(reasons, r.profile.profileId, `Donjon ${r.dungeonName}`);
  }
  for (const r of alignmentHelpers) {
    const label = r.alignment.charAt(0).toUpperCase() + r.alignment.slice(1);
    pushReason(
      reasons,
      r.profile.profileId,
      r.requiredLevel ? `Alignement ${label} ${r.requiredLevel}` : `Alignement ${label}`
    );
  }

  const helpers = members
    .filter((m) => reasons.has(m.profileId))
    .map((m) => ({ profile: m, reasons: reasons.get(m.profileId)! }));

  // ── « Niveau à confirmer » (Option A) : le membre POSSÈDE le métier / camp requis
  //    mais son niveau/tranche est inconnu → on le signale plutôt que de le cacher.
  const uncertainReasons = new Map<string, string[]>();
  for (const need of metierNeeds) {
    for (const m of members) {
      const r = matchMetier(need, m);
      if (r.levelUnknown) {
        const level = r.requiredLevel ?? "";
        pushReason(
          uncertainReasons,
          r.profile.profileId,
          level ? `Métier ${r.metier} ${level} (niveau à confirmer)` : `Métier ${r.metier} (niveau à confirmer)`
        );
      }
    }
  }
  if (alignmentNeed) {
    for (const m of members) {
      const r = matchAlignment(alignmentNeed, m);
      if (r.levelUnknown) {
        const label = r.alignment.charAt(0).toUpperCase() + r.alignment.slice(1);
        const level = r.requiredLevel ?? "";
        pushReason(
          uncertainReasons,
          r.profile.profileId,
          level ? `Alignement ${label} ${level} (niveau à confirmer)` : `Alignement ${label} (niveau à confirmer)`
        );
      }
    }
  }
  const uncertainHelpers = members
    .filter((m) => uncertainReasons.has(m.profileId))
    .map((m) => ({ profile: m, reasons: uncertainReasons.get(m.profileId)! }));

  return { metierHelpers, dungeonHelpers, alignmentHelpers, helpers, uncertainHelpers };
}

