type MilestoneSequenceLike = {
  subGuideRef: string;
  stepFrom?: number | null;
  stepTo?: number | null;
};

export function buildMilestoneStepKeys(sequences: MilestoneSequenceLike[]): string[] {
  const stepKeys: string[] = [];

  for (const seq of sequences) {
    if (seq.stepFrom !== null && seq.stepFrom !== undefined && seq.stepTo !== null && seq.stepTo !== undefined) {
      for (let i = seq.stepFrom; i <= seq.stepTo; i++) {
        stepKeys.push(`${seq.subGuideRef}-${i}`);
      }
    } else {
      stepKeys.push(`${seq.subGuideRef}-all`);
    }
  }

  return stepKeys;
}

// ─── Phase I — Agrégation serveur du guildProgress (AUDIT-MILITAIRE §2.1) ─────────
// `getGuildOptimizedGuideProgress` renvoie désormais des structures réduites
// (lignes allégées + membres agrégés + carte de présence) au lieu du dump brut
// `PlayerGuideProgress` avec profil + user complets sérialisés vers le client.

/** Entrée brute issue du select chirurgical sur `PlayerGuideProgress` (+ profil minimal). */
export type GuideProgressRowSource = {
  profileId: string;
  milestoneId: string;
  characterSlot?: string;
  isCompleted: boolean;
  completedSteps?: unknown;
  currentStep?: string | null;
  profile?: {
    pseudoDofus?: string | null;
    alignment?: string | null;
    alignmentOrder?: string | null;
    alignmentLevel?: number | null;
    altPseudos?: unknown;
    user?: { name?: string | null; image?: string | null } | null;
  } | null;
};

/** Ligne allégée — shape EXACTE de la prop client `guildProgress` (page.tsx mappe `allProgress`). */
export type GuideProgressRow = {
  profileId: string;
  milestoneId: string;
  characterSlot?: string;
  isCompleted: boolean;
  completedSteps: string[];
  currentStep: string | null;
  userName: string;
  userAvatar?: string;
  profileSlug: string;
  /** Alignement rusher (perso principal) — camp et niveau pour la visibilité guilde. */
  alignment?: string | null;
  alignmentOrder?: string | null;
  alignmentLevel?: number | null;
};

/** Membre agrégé côté serveur — sérialisable (arrays, jamais de Set/Map dans le payload). */
export type GuideProgressMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  profileSlug?: string;
  completedSteps: string[];
  completedMilestoneIds: string[];
  bookmarkedSteps: { milestoneId: string; stepKey: string }[];
  currentMilestoneId: string | null;
  /** Alignement rusher (perso principal) pour la visibilité guilde. */
  alignment?: string | null;
  alignmentOrder?: string | null;
  alignmentLevel?: number | null;
};

/** Carte présence `milestoneId → membres` (dédupliqués par profileId). */
export type GuidePresenceMap = Record<string, GuideProgressMember[]>;

type MilestoneOrderLike = { id: string; order: number };

/** Normalise le JSON `completedSteps` en tableau de chaînes (défensif). */
function toStepKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is string => typeof s === "string");
}

/**
 * Construit les lignes client à partir du select chirurgical.
 * Repli identique au mapping historique de page.tsx :
 *   userName = pseudoDofus || user.name || "Voyageur" ; profileSlug = pseudoDofus || profileId.
 */
export function buildGuildProgressRows(rows: GuideProgressRowSource[]): GuideProgressRow[] {
  return rows.map((p) => {
    const slot = p.characterSlot || "PRINCIPAL";
    const alts = Array.isArray((p.profile as any)?.altPseudos)
      ? ((p.profile as any).altPseudos as any[])
      : [];
    // Alignement du personnage de CETTE ligne (principal ou mule).
    let alignment: string | null = null;
    let alignmentOrder: string | null = null;
    let alignmentLevel: number | null = null;
    if (slot !== "PRINCIPAL") {
      const mule = alts.find((m: any) => m.pseudo === slot);
      alignment = mule?.alignment ?? null;
      alignmentOrder = mule?.alignmentOrder ?? null;
      alignmentLevel = mule?.alignmentLevel ?? null;
    } else {
      alignment = (p.profile as any)?.alignment ?? null;
      alignmentOrder = (p.profile as any)?.alignmentOrder ?? null;
      alignmentLevel = (p.profile as any)?.alignmentLevel ?? null;
    }
    return {
      profileId: p.profileId,
      milestoneId: p.milestoneId,
      characterSlot: slot,
      isCompleted: p.isCompleted || false,
      completedSteps: toStepKeys(p.completedSteps),
      currentStep: p.currentStep || null,
      userName: p.profile?.pseudoDofus || p.profile?.user?.name || "Voyageur",
      userAvatar: p.profile?.user?.image || undefined,
      profileSlug: p.profile?.pseudoDofus || p.profileId,
      alignment,
      alignmentOrder,
      alignmentLevel,
    };
  });
}

/**
 * Agrège les lignes par `profileId` (port serveur du `useMemo` de OptimizedGuideClient).
 * `currentMilestoneId` suit la même stratégie que le client : dernière activité la plus
 * avancée, avancée vers le prochain jalon non complété si le jalon actif est déjà complété.
 */
export function buildUniqueGuildMembers(
  rows: GuideProgressRow[],
  milestones: MilestoneOrderLike[],
): GuideProgressMember[] {
  type Acc = {
    profileId: string;
    userName: string;
    userAvatar?: string;
    profileSlug?: string;
    alignment?: string | null;
    alignmentOrder?: string | null;
    alignmentLevel?: number | null;
    activeScore: number;
    completedSteps: string[];
    completedMilestoneIds: string[];
    bookmarkedSteps: { milestoneId: string; stepKey: string }[];
    activeMilestoneIds: Set<string>;
  };

  const byProfile = new Map<string, Acc>();

  for (const p of rows) {
    let acc = byProfile.get(p.profileId);
    if (!acc) {
      acc = {
        profileId: p.profileId,
        userName: p.userName,
        userAvatar: p.userAvatar,
        profileSlug: p.profileSlug,
        alignment: p.alignment ?? null,
        alignmentOrder: p.alignmentOrder ?? null,
        alignmentLevel: p.alignmentLevel ?? null,
        activeScore: -1,
        completedSteps: [],
        completedMilestoneIds: [],
        bookmarkedSteps: [],
        activeMilestoneIds: new Set<string>(),
      };
      byProfile.set(p.profileId, acc);
    }

    // Personnage « actif » : repère (bookmark) > nombre d'étapes cochées > premier.
    const score = (p.currentStep ? 2 : 0) + Math.min(p.completedSteps.length, 5);
    if (score > acc.activeScore) {
      acc.activeScore = score;
      acc.alignment = p.alignment ?? null;
      acc.alignmentOrder = p.alignmentOrder ?? null;
      acc.alignmentLevel = p.alignmentLevel ?? null;
    }

    if (p.completedSteps.length > 0) {
      acc.completedSteps.push(...p.completedSteps);
      acc.activeMilestoneIds.add(p.milestoneId);
    }
    if (p.isCompleted) {
      acc.completedMilestoneIds.push(p.milestoneId);
      acc.activeMilestoneIds.add(p.milestoneId);
    }
    if (p.currentStep) {
      const idx = acc.bookmarkedSteps.findIndex((b) => b.milestoneId === p.milestoneId);
      if (idx >= 0) acc.bookmarkedSteps[idx] = { milestoneId: p.milestoneId, stepKey: p.currentStep };
      else acc.bookmarkedSteps.push({ milestoneId: p.milestoneId, stepKey: p.currentStep });
      acc.activeMilestoneIds.add(p.milestoneId);
    }
  }

  const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);

  return Array.from(byProfile.values()).map((m) => {
    const completedMilestoneIds = new Set(m.completedMilestoneIds);

    // Dernier jalon avec une activité (étapes cochées, marque-page, complétion).
    let bestActiveOrder = -1;
    let bestActiveId: string | null = null;
    for (const ms of sortedMilestones) {
      if (m.activeMilestoneIds.has(ms.id) && ms.order > bestActiveOrder) {
        bestActiveOrder = ms.order;
        bestActiveId = ms.id;
      }
    }

    let currentMilestoneId: string | null = null;
    if (bestActiveId) {
      if (completedMilestoneIds.has(bestActiveId)) {
        const next = sortedMilestones.find(
          (ms) => ms.order > bestActiveOrder && !completedMilestoneIds.has(ms.id),
        );
        currentMilestoneId = next ? next.id : null; // null = guide entièrement complété
      } else {
        currentMilestoneId = bestActiveId;
      }
    } else if (m.completedMilestoneIds.length > 0) {
      // Des jalons complétés mais aucune activité courante → prochain jalon non complété.
      let maxCompletedOrder = -1;
      for (const id of m.completedMilestoneIds) {
        const ms = sortedMilestones.find((s) => s.id === id);
        if (ms && ms.order > maxCompletedOrder) maxCompletedOrder = ms.order;
      }
      const next = sortedMilestones.find(
        (ms) => ms.order > maxCompletedOrder && !completedMilestoneIds.has(ms.id),
      );
      currentMilestoneId = next ? next.id : null;
    }
    // Sans aucune activité : currentMilestoneId reste null → absent de la carte de présence.

    return {
      profileId: m.profileId,
      userName: m.userName,
      userAvatar: m.userAvatar,
      profileSlug: m.profileSlug,
      alignment: m.alignment ?? null,
      alignmentOrder: m.alignmentOrder ?? null,
      alignmentLevel: m.alignmentLevel ?? null,
      completedSteps: [...new Set(m.completedSteps)],
      completedMilestoneIds: [...new Set(m.completedMilestoneIds)],
      currentMilestoneId,
      bookmarkedSteps: m.bookmarkedSteps,
    };
  });
}

/**
 * Carte `milestoneId → membres` pour la présence (déduplication par profileId,
 * membres sans `currentMilestoneId` ignorés). Même logique que le `useMemo` client.
 */
export function buildPresenceMap(members: GuideProgressMember[]): GuidePresenceMap {
  const map: GuidePresenceMap = {};
  const seen = new Set<string>();
  for (const m of members) {
    if (!m.currentMilestoneId) continue;
    if (seen.has(m.profileId)) continue;
    seen.add(m.profileId);
    if (!map[m.currentMilestoneId]) map[m.currentMilestoneId] = [];
    map[m.currentMilestoneId].push(m);
  }
  return map;
}
