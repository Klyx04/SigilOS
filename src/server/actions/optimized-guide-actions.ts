"use server";
// Force reload after schema update


import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { auth } from "@/auth";
import { isSuperAdmin } from "./super-admin-actions";
import { revalidatePath } from "next/cache";

/**
 * Récupère tous les guides disponibles.
 */
export async function getOptimizedGuides(guildId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const isGod = await isSuperAdmin();
  let isAdmin = isGod;

  if (!isGod && guildId) {
    const ctx = await getUserContext(guildId);
    isAdmin = ctx.isAdmin;
  }

  // Si admin, on fetch tout. Sinon, seulement les actifs
  const whereCl = isAdmin ? {} : { isActive: true };

  const guides = await db.optimizedGuide.findMany({
    where: whereCl,
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return { success: true, guides };
}

export async function getOptimizedGuideDetail(slug: string, guildId: string, altPseudo?: string) {

  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");

  let profileId = ctx.profileId;

  // If an altPseudo is provided, resolve its profileId from the main profile's altPseudos JSON
  if (altPseudo && altPseudo !== "PRINCIPAL" && ctx.profileId) {
    const mainProfile = await db.userProfile.findUnique({
      where: { id: ctx.profileId },
      select: { altPseudos: true }
    });
    const altList = Array.isArray(mainProfile?.altPseudos) ? (mainProfile.altPseudos as any[]) : [];
    const muleEntry = altList.find((m: any) =>
      (typeof m === "string" ? m : m.pseudo) === altPseudo
    );
    // Mules share the same profileId but use a different "character slot" key in PlayerGuideProgress
    // For guides, we use a dedicated per-mule progress record keyed by a virtual profileId.
    // We embed the mule name as a suffix on the profileId to create a unique slot.
    if (muleEntry) {
      profileId = `${ctx.profileId}::${altPseudo}`;
    }
  }

  const guide = await db.optimizedGuide.findUnique({
    where: { slug },
    include: {
      milestones: {
        orderBy: { order: "asc" },
        include: {
          sequences: {
            orderBy: { order: "asc" },
            include: { dungeon: true }
          },
          // Only filter by profile if one exists (SuperAdmins may not have one)
          playerProgress: profileId
            ? { where: { profileId } }
            : { where: { profileId: "__NONE__" } },
        }
      }
    },
  });

  if (!guide) return { success: false, error: "Guide introuvable" };

  return { success: true, guide, resolvedProfileId: profileId };
}

/**
 * (Admin) Créer ou mettre à jour un guide.
 */
export async function upsertOptimizedGuide(
  guildId: string | undefined,
  data: {
    id?: string;
    slug: string;
    name: string;
    description?: string;
    imageUrl?: string;
    isActive: boolean;
    steps: {
      id?: string;
      order: number;
      title: string;
      description?: string;
      questIds: string[];
      objectives?: any[];
      customTasks?: any;
    }[];
  }
) {
  const isGod = await isSuperAdmin();
  if (!isGod) {
    if (!guildId) throw new Error("Guild ID requis");
    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin) throw new Error("Droits administrateur requis");
  }

  const { id, steps, ...guideData } = data;

  if (id) {
    // Update
    const guide = await db.optimizedGuide.update({
      where: { id },
      data: guideData,
    });

    // Delete existing steps completely (it's simpler to rebuild)
    await db.optimizedGuideStep.deleteMany({
      where: { guideId: id },
    });

    // Create steps
    if (steps && steps.length > 0) {
      await db.optimizedGuideStep.createMany({
        data: steps.map((s) => ({
          ...s,
          id: undefined, 
          guideId: id,
          // Migration logic: if objectives is missing but questIds exists, convert it
          objectives: s.objectives || (s.questIds ? s.questIds.map(qid => ({ type: 'QUEST', id: qid })) : []),
          customTasks: s.customTasks || []
        })),
      });
    }

    revalidatePath(`/god/dofus-guides`);
    if (guildId) revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${guideData.slug}`);
    return { success: true, guide };
  } else {
    // Create
    const guide = await db.optimizedGuide.create({
      data: {
        ...guideData,
        steps: {
          create: steps.map((s) => ({ 
            ...s, 
            id: undefined,
            objectives: s.objectives || (s.questIds ? s.questIds.map(qid => ({ type: 'QUEST', id: qid })) : []),
            customTasks: s.customTasks || []
          })),
        },
      },
    });

    revalidatePath(`/god/dofus-guides`);
    return { success: true, guide };
  }
}

/**
 * (Admin) Supprimer un guide.
 */
export async function deleteOptimizedGuide(guildId: string | undefined, guideId: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) {
      if (!guildId) throw new Error("Guild ID requis");
      const ctx = await getUserContext(guildId);
      if (!ctx.isAdmin) throw new Error("Droits administrateur requis");
  }

  await db.optimizedGuide.delete({
    where: { id: guideId },
  });

  revalidatePath(`/god/dofus-guides`);
  return { success: true };
}

/**
 * Calcule à quelle étape de la route se trouve chaque membre de la guilde.
 * Basé sur les PlayerGuideProgress.
 */
export async function getGuildOptimizedGuideProgress(slug: string, guildId: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");

  const guide = await db.optimizedGuide.findUnique({
    where: { slug },
    select: { id: true }
  });

  if (!guide) return { success: false, error: "Guide introuvable" };

  // Récupérer toutes les progressions des membres pour ce guide (avec isolation de guilde)
  const allProgress = await db.playerGuideProgress.findMany({
    where: {
      milestone: { guideId: guide.id },
      profile: { guild: { discordGuildId: guildId } }
    },
    include: {
      profile: {
        include: { user: true }
      }
    }
  });

  return { success: true, allProgress };
}

/**
 * Récupère la progression d'UN membre sur TOUS les guides actifs de la guilde.
 * Utilisé pour le modal de détail membre dans la Progression Commune.
 */
export async function getMemberAllGuidesProgress(profileId: string, guildId: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");

  const guides = await db.optimizedGuide.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      milestones: {
        select: {
          id: true,
          title: true,
          order: true,
          accentColor: true,
          playerProgress: {
            where: { profileId },
            select: { isCompleted: true, milestoneId: true },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const guideProgress = guides.map((guide) => {
    const total = guide.milestones.length;
    const completedIds = new Set(
      guide.milestones
        .filter((m) => m.playerProgress.some((p) => p.isCompleted))
        .map((m) => m.id)
    );
    const completed = completedIds.size;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const activeMilestone = guide.milestones.find((m) => !completedIds.has(m.id));

    return {
      guideId: guide.id,
      guideSlug: guide.slug,
      guideName: guide.name,
      total,
      completed,
      percent,
      activeMilestone: activeMilestone
        ? { id: activeMilestone.id, title: activeMilestone.title, order: activeMilestone.order }
        : null,
    };
  });

  return { success: true, guideProgress };
}

/**
 * Marquer un milestone comme terminé/non terminé pour l'utilisateur courant.
 */
export async function toggleMilestoneProgress(guildId: string, milestoneId: string, isCompleted: boolean, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.id) throw new Error("Profile ID manquant");

  let profileId: string = ctx.profileId!;
  if (altPseudo && altPseudo !== "PRINCIPAL") {
    profileId = `${ctx.profileId}::${altPseudo}`;
  }

  const progress = await db.playerGuideProgress.upsert({
    where: {
      profileId_milestoneId: { profileId, milestoneId }
    },
    update: {
      isCompleted,
      completedAt: isCompleted ? new Date() : null
    },
    create: {
      profileId,
      milestoneId,
      isCompleted,
      completedAt: isCompleted ? new Date() : null
    }
  });

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: { guide: { select: { slug: true } } }
  });
  if (milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
  }

  revalidatePath(`/dashboard/${guildId}/quetes-dofus/routes/progression-complete`);
  return { success: true, progress };
}

/**
 * Réinitialise la progression d'un milestone (étapes + validation + marque-page).
 */
export async function resetMilestoneProgress(guildId: string, milestoneId: string, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  let profileId: string = ctx.profileId;
  if (altPseudo && altPseudo !== "PRINCIPAL") {
    profileId = `${ctx.profileId}::${altPseudo}`;
  }

  // Delete the progress record entirely (cleaner than zeroing out)
  await db.playerGuideProgress.deleteMany({
    where: { profileId, milestoneId }
  });

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: { guide: { select: { slug: true } } }
  });
  if (milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
  }
  revalidatePath(`/dashboard/${guildId}/quetes-dofus/routes/progression-complete`);
  return { success: true };
}

/**
 * Réinitialise toute la progression d'un guide pour l'utilisateur courant.
 */
export async function resetGuideProgress(guildId: string, guideId: string, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  let profileId: string = ctx.profileId;
  if (altPseudo && altPseudo !== "PRINCIPAL") {
    profileId = `${ctx.profileId}::${altPseudo}`;
  }

  // Fetch all milestone IDs for this guide
  const milestones = await db.guideMilestone.findMany({
    where: { guideId },
    select: { id: true }
  });
  const milestoneIds = milestones.map(m => m.id);

  if (milestoneIds.length > 0) {
    await db.playerGuideProgress.deleteMany({
      where: { profileId, milestoneId: { in: milestoneIds } }
    });
  }

  // Also look up guide slug for cache invalidation
  const guide = await db.optimizedGuide.findUnique({
    where: { id: guideId },
    select: { slug: true }
  });
  if (guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${guide.slug}`);
  }
  revalidatePath(`/dashboard/${guildId}/quetes-dofus/routes/progression-complete`);
  return { success: true };
}

/**
 * Met à jour les étapes individuelles cochées pour un milestone.
 */
export async function updateStepProgress(guildId: string, milestoneId: string, completedSteps: string[], altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  let profileId: string = ctx.profileId;
  if (altPseudo && altPseudo !== "PRINCIPAL") {
    profileId = `${ctx.profileId}::${altPseudo}`;
  }

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: {
      guide: { select: { slug: true } },
      sequences: { select: { id: true } }
    }
  });

  const totalSeqCount = milestone?.sequences.length || 0;
  const isAllCompleted = totalSeqCount > 0 && milestone!.sequences.every(s => completedSteps.includes(s.id));

  const progress = await db.playerGuideProgress.upsert({
    where: {
      profileId_milestoneId: { profileId, milestoneId }
    },
    update: {
      completedSteps: completedSteps,
      isCompleted: isAllCompleted,
      completedAt: isAllCompleted ? new Date() : null
    },
    create: {
      profileId,
      milestoneId,
      completedSteps: completedSteps,
      isCompleted: isAllCompleted,
      completedAt: isAllCompleted ? new Date() : null
    }
  });

  if (milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
  }

  revalidatePath(`/dashboard/${guildId}/quetes-dofus/routes/progression-complete`);
  return { success: true, progress, isCompleted: isAllCompleted };
}

/**
 * Met à jour l'étape active/marque-page pour un milestone (J'en suis là).
 */
export async function updateBookmarkedStep(guildId: string, milestoneId: string, stepKey: string | null) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  const profileId: string = ctx.profileId!;

  const progress = await db.playerGuideProgress.upsert({
    where: {
      profileId_milestoneId: { profileId, milestoneId }
    },
    update: {
      currentStep: stepKey 
    },
    create: {
      profileId,
      milestoneId,
      currentStep: stepKey,
      isCompleted: false
    }
  });

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: { guide: { select: { slug: true } } }
  });
  if (milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
  }

  return { success: true, progress };
}

// ===========================================================================
// GOD-SIDE ADMIN ACTIONS
// ===========================================================================

/**
 * Récupère le guide complet avec ses milestones et séquences pour l'admin.
 */
export async function getGuideAdminFull(guideId: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  const guide = await db.optimizedGuide.findUnique({
    where: { id: guideId },
    include: {
      milestones: {
        orderBy: { order: "asc" },
        include: {
          sequences: { orderBy: { order: "asc" } },
          playerProgress: {
            include: { profile: { include: { user: true } } }
          }
        }
      }
    }
  });

  if (!guide) return { success: false, error: "Guide introuvable" };
  return { success: true, guide };
}

/**
 * Récupère la progression de tous les membres pour un guide (côté God).
 */
export async function getGuildProgressSummary(guideId: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  const allProgress = await db.playerGuideProgress.findMany({
    where: { milestone: { guideId } },
    include: {
      profile: { include: { user: true } },
      milestone: { select: { id: true, title: true, order: true, accentColor: true } }
    },
    orderBy: { completedAt: "desc" }
  });

  return { success: true, allProgress };
}

/**
 * Crée ou met à jour un milestone.
 */
export async function upsertMilestone(data: {
  id?: string;
  guideId: string;
  title: string;
  subtitle?: string;
  description?: string;
  chapter?: number;
  chapterLabel?: string;
  type?: string;
  accentColor?: string;
  imageUrl?: string;
  order: number;
  posX?: number;
  posY?: number;
  isOptional?: boolean;
}) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  // Destructure explicitly to avoid passing unknown fields (sequences, playerProgress, etc.)
  // to Prisma which would throw on unrecognized fields
  const { id, guideId, sequences: _seq, playerProgress: _pp, ...rest } = data as any;

  // Ensure required fields have defaults — only valid Prisma fields
  const milestoneData = {
    title: rest.title,
    subtitle: rest.subtitle ?? null,
    description: rest.description ?? null,
    chapter: rest.chapter ?? 1,
    chapterLabel: rest.chapterLabel ?? `Chapitre ${rest.chapter ?? 1}`,
    type: (rest.type as any) ?? "DOFUS",
    accentColor: rest.accentColor ?? "#10b981",
    imageUrl: rest.imageUrl ?? null,
    order: rest.order,
    posX: rest.posX ?? 0,
    posY: rest.posY ?? 0,
    isOptional: rest.isOptional ?? false,
  };

  const milestone = id
    ? await db.guideMilestone.update({ where: { id }, data: milestoneData })
    : await db.guideMilestone.create({ data: { guideId, ...milestoneData } });

  revalidatePath("/god/dofus-guides");
  return { success: true, milestone };
}

/**
 * Supprime un milestone (et ses séquences en cascade).
 */
export async function deleteMilestone(milestoneId: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  await db.guideMilestone.delete({ where: { id: milestoneId } });
  revalidatePath("/god/dofus-guides");
  return { success: true };
}

/**
 * Crée ou met à jour une séquence.
 */
export async function upsertSequence(data: {
  id?: string;
  milestoneId: string;
  subGuideRef: string;
  subGuideName: string;
  stepFrom?: number;
  stepTo?: number;
  note?: string;
  isOptional?: boolean;
  order: number;
}) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  const { id, milestoneId, ...seqData } = data;

  const sequence = id
    ? await db.guideSequence.update({ where: { id }, data: seqData })
    : await db.guideSequence.create({ data: { milestoneId, ...seqData } });

  revalidatePath("/god/dofus-guides");
  return { success: true, sequence };
}

/**
 * Supprime une séquence.
 */
export async function deleteSequence(sequenceId: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  await db.guideSequence.delete({ where: { id: sequenceId } });
  revalidatePath("/god/dofus-guides");
  return { success: true };
}

/**
 * Supprime TOUS les milestones d'un guide (reset avant import).
 */
export async function deleteAllMilestones(guideId: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  await db.guideMilestone.deleteMany({ where: { guideId } });
  revalidatePath("/god/dofus-guides");
  return { success: true };
}

/**
 * Importe et stocke un sous-guide Ganymède (GP1, GP2...) en base.
 * Le JSON contient { id, name, steps: [{ id, web_text, pos_x, pos_y }] }
 */
export async function importSubGuide(jsonData: any) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  const { parseSubGuideSteps } = await import("@/lib/ganymede-parser");

  const ganymadeId: number = jsonData.id;
  const guideName: string = jsonData.name ?? `Guide #${ganymadeId}`;
  const rawSteps: any[] = jsonData.steps ?? [];

  const refMatch = guideName.match(/\[(GP\d+)\]/i);
  const guideRef = refMatch ? refMatch[1].toUpperCase() : `GP${ganymadeId}`;

  // Parse enrichi : chaque step contient maintenant pos_x/y, map, dungeons, guideRefs, plainText
  const enrichedSteps = parseSubGuideSteps(rawSteps);

  const subGuide = await db.subGuideData.upsert({
    where: { guideRef },
    update: { ganymadeId, guideName, totalSteps: rawSteps.length, steps: enrichedSteps },
    create: { ganymadeId, guideName, guideRef, totalSteps: rawSteps.length, steps: enrichedSteps },
  });

  revalidatePath("/god/dofus-guides");
  return { success: true, guideRef, guideName, totalSteps: rawSteps.length, subGuide };
}


/**
 * Récupère les étapes d'un sous-guide pour une plage donnée.
 */
export async function getSubGuideSteps(guideRef: string, stepFrom?: number, stepTo?: number) {
  const subGuide = await db.subGuideData.findUnique({ where: { guideRef } });
  if (!subGuide) return { success: false, error: `Sous-guide ${guideRef} non importé` };

  const allSteps = (subGuide.steps as any[]);
  let from = stepFrom ?? 1;
  let to = stepTo ?? allSteps.length;
  
  // Sécurité : si les numéros d'étape demandés dépassent la taille actuelle du guide, on les capte
  if (from > allSteps.length) from = allSteps.length;
  if (to > allSteps.length) to = allSteps.length;
  if (from > to) from = to;

  const filtered = allSteps.filter((s: any) => s.stepNumber >= from && s.stepNumber <= to);

  return { success: true, guideRef, guideName: subGuide.guideName, steps: filtered, totalSteps: subGuide.totalSteps };
}

/**
 * Liste tous les sous-guides importés.
 */
export async function listSubGuides() {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  const subs = await db.subGuideData.findMany({
    select: { id: true, guideRef: true, guideName: true, ganymadeId: true, totalSteps: true, createdAt: true },
    orderBy: { guideRef: "asc" },
  });

  return { success: true, subs };
}

/**
 * Supprime un sous-guide importé et ses références dans les séquences.
 */
export async function deleteSubGuide(guideRef: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  // Supprimer le sous-guide de la bibliothèque
  await db.subGuideData.delete({ where: { guideRef } });

  revalidatePath("/god/dofus-guides");
  return { success: true, message: `Sous-guide ${guideRef} supprimé.` };
}

/**
 * Trouve le guide (slug) qui contient un sous-guide donné (ref = "GP24" etc.)
 * Utilisé pour la navigation cross-guide depuis les liens guide-step.
 */
export async function findGuideBySubRef(subGuideRef: string): Promise<{ success: boolean; slug?: string; guideName?: string }> {
  const seq = await db.guideSequence.findFirst({
    where: { subGuideRef },
    include: {
      milestone: {
        include: {
          guide: { select: { slug: true, name: true } },
        },
      },
    },
  });
  if (!seq) return { success: false };
  const guide = (seq as any).milestone?.guide;
  return guide ? { success: true, slug: guide.slug, guideName: guide.name } : { success: false };
}



/**
 * Met à jour une étape spécifique dans un sous-guide.
 */
export async function updateSubGuideStep(guideRef: string, stepNumber: number, newData: any) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  const subGuide = await db.subGuideData.findUnique({ where: { guideRef } });
  if (!subGuide) return { success: false, error: "Sous-guide introuvable" };

  const steps = [...(subGuide.steps as any[])];
  const idx = steps.findIndex((s: any) => s.stepNumber === stepNumber);
  if (idx === -1) return { success: false, error: "Étape introuvable" };

  steps[idx] = { ...steps[idx], ...newData };

  await db.subGuideData.update({
    where: { guideRef },
    data: { steps }
  });

  return { success: true };
}

/**
 * Met à jour les positions X/Y des nœuds après un drag-and-drop.
 */
export async function updateMilestonePositions(
  positions: { id: string; posX: number; posY: number }[]
) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  await Promise.all(
    positions.map((p) =>
      db.guideMilestone.update({
        where: { id: p.id },
        data: { posX: p.posX, posY: p.posY }
      })
    )
  );

  return { success: true };
}

// ---------------------------------------------------------------------------
// PARSER GANYMÈDE JSON
// ---------------------------------------------------------------------------

/**
 * Parse un JSON Ganymède (GP0) et crée/remplace les milestones.
 * FIXES:
 * - Titre : utilise step.name (champ natif Ganymède) au lieu du regex fragile
 * - subGuideRef : extrait [GPX] depuis guideName au lieu de l'ID interne Ganymède
 * - Type : détection DOFUS / DONJON / QUETE_SERIE / PREREQUIS
 * - Chapitre : groupé par numéro GP de la première séquence
 */
export async function importGanymedeGuide(guideId: string, jsonData: any) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Super-admin requis");

  const guide = await db.optimizedGuide.findUnique({ where: { id: guideId } });
  if (!guide) return { success: false, error: "Guide introuvable" };

  const steps: any[] = jsonData.steps ?? [];

  // load existing milestones to do smart upsert and avoid deleting player progress cascades
  const existingMilestones = await db.guideMilestone.findMany({
    where: { guideId },
    include: { sequences: true }
  });

  // Pré-charger les sous-guides importés pour résoudre ganymadeId → "GP1", "GP2"...
  const importedSubs = await db.subGuideData.findMany({
    select: { ganymadeId: true, guideRef: true }
  });
  const idToRefMap = new Map<number, string>();
  importedSubs.forEach(s => idToRefMap.set(s.ganymadeId, s.guideRef));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let noProperTitle = 0;
  let order = 1;

  // Helper: extract [GPX] prefix from any string
  const extractGpRef = (...sources: string[]): string | null => {
    for (const src of sources) {
      const m = src.match(/\[GP(\d+)\]/i);
      if (m) return `GP${m[1]}`;
    }
    return null;
  };

  // Helper: is this a garbage auto-generated Ganymède title?
  const isGarbageTitle = (t: string): boolean => {
    // "Étape 522097", "Step 1234", purely numeric, or < 3 chars
    if (/^[ÉEé]tape\s+\d+$/i.test(t.trim())) return true;
    if (/^Step\s+\d+$/i.test(t.trim())) return true;
    if (/^\d+$/.test(t.trim())) return true;
    if (t.trim().length < 3) return true;
    if (t.includes("Vous trouverez ici")) return true;
    if (t.includes("placeholder")) return true;
    return false;
  };

  const activeMilestoneIds = new Set<string>();

  // ── HTML entity decoder (server-side, no DOMParser) ─────────────────────
  const decodeHtmlEntities = (str: string): string =>
    str
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&oelig;/g, "œ")
      .replace(/&Oelig;/g, "Œ")
      .replace(/&eacute;/g, "é")
      .replace(/&Eacute;/g, "É")
      .replace(/&agrave;/g, "à")
      .replace(/&Agrave;/g, "À")
      .replace(/&egrave;/g, "è")
      .replace(/&Egrave;/g, "È")
      .replace(/&ugrave;/g, "ù")
      .replace(/&acirc;/g, "â")
      .replace(/&ecirc;/g, "ê")
      .replace(/&icirc;/g, "î")
      .replace(/&ocirc;/g, "ô")
      .replace(/&ucirc;/g, "û")
      .replace(/&ccedil;/g, "ç")
      .replace(/&#\d+;/g, "") // strip remaining numeric entities
      .replace(/\s+/g, " ")
      .trim();

  for (const step of steps) {
    const html: string = step.web_text ?? "";

    // ── SKIP: Étapes tutoriel Ganymède ─────────────────────────────────────
    // La première étape de GP0 is always the internal tutorial "Guide utilisateur Ganymède"
    const isGanymedeTuto = html.includes("Guide utilisateur Ganymède") ||
      html.includes("guide-utilisateur-ganymede") ||
      (step.name ?? "").includes("Guide utilisateur");
    if (isGanymedeTuto) { skipped++; continue; }

    // ── 1. TITRE ─────────────────────────────────────────────────────────────
    let rawTitle: string | null = null;

    // P1: step.name si non-garbage
    const stepName = (step.name as string | undefined)?.trim() ?? "";
    if (stepName && !isGarbageTitle(stepName)) rawTitle = stepName;

    // P2: Zone "Objectifs :" dans le HTML — extrait le texte complet en strippant les tags
    if (!rawTitle) {
      // Match everything after "Objectifs :" up to the next block-level closing tag
      const objMatch = html.match(/Objectifs?\s*:([\s\S]{3,400}?)(?:<\/p>|<\/div>|<br|\n\n)/i);
      if (objMatch) {
        let objHtml = objMatch[1];
        // Preserve image alt/title
        objHtml = objHtml.replace(/<img[^>]+alt=["']([^"']+)["'][^>]*>/gi, " $1 ");
        objHtml = objHtml.replace(/<img[^>]+title=["']([^"']+)["'][^>]*>/gi, " $1 ");
        const plain = objHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const decoded = decodeHtmlEntities(plain).substring(0, 150);
        if (decoded.length >= 3 && !isGarbageTitle(decoded)) rawTitle = decoded;
      }
    }

    // P3: Premier texte en <strong> (souvent le titre réel de la phase)
    if (!rawTitle) {
      const m = html.match(/<strong[^>]*>\s*([^<]{4,100})\s*<\/strong>/i);
      if (m) {
        const candidate = decodeHtmlEntities(m[1]);
        if (!isGarbageTitle(candidate)) rawTitle = candidate;
      }
    }

    // P4: Premier <h1>/<h2>/<h3> dans le HTML
    if (!rawTitle) {
      const m = html.match(/<h[123][^>]*>\s*([^<]{4,100})\s*<\/h[123]>/i);
      if (m) rawTitle = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ""));
    }

    // Fallback séquentiel propre (PAS l'ID Ganymède)
    if (!rawTitle || isGarbageTitle(rawTitle)) {
      noProperTitle++;
      rawTitle = null; // On va chercher depuis la séquence plus bas
    }

    // ── 2. PARSE DES SOUS-GUIDES RÉFÉRENCÉS ─────────────────────────────────
    const guideStepPattern = /data-type="guide-step"[^>]*>/gi;
    const attrExtract = (tag: string, attr: string): string => {
      const m = tag.match(new RegExp(`${attr}="([^"]*)"`));
      return m?.[1] ?? "";
    };

    const sequences: {
      ref: string; name: string; stepFrom?: number; stepTo?: number;
      note?: string; isResume?: boolean
    }[] = [];
    const seenRefs = new Set<string>();

    let tagMatch: RegExpExecArray | null;
    guideStepPattern.lastIndex = 0;
    while ((tagMatch = guideStepPattern.exec(html)) !== null) {
      const fullTag = tagMatch[0];
      const ganymadeId = attrExtract(fullTag, "guideid");
      const guideName  = attrExtract(fullTag, "guidename");
      const label      = attrExtract(fullTag, "label");

      let ref = ganymadeId ? idToRefMap.get(parseInt(ganymadeId)) ?? null : null;
      if (!ref) ref = extractGpRef(guideName, label);
      if (!ref && ganymadeId) {
        const tagIdx = tagMatch.index;
        const ctx = html.substring(Math.max(0, tagIdx - 100), tagIdx + 600);
        ref = extractGpRef(ctx);
      }
      if (!ref && ganymadeId) ref = `GP_ID${ganymadeId}`;

      if (!ref || seenRefs.has(ref)) continue;
      seenRefs.add(ref);

      const cleanName = (guideName || label)
        .replace(/^\[GP\d+\]\s*/i, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .trim() || ref;

      const tagIdx = tagMatch.index;
      const surrounding = html
        .substring(Math.max(0, tagIdx - 300), tagIdx + 600)
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const fullCtx = label + " " + surrounding;

      const rangeM = fullCtx.match(/de l['']?[eé]tape\s+(\d+)\s+(?:[àa]|jusqu['']?[àa])\s+(?:l['']?[eé]tape\s+)?(\d+)/i);
      const toOnlyM = fullCtx.match(/jusqu['']?[àa]\s+l['']?[eé]tape\s+(\d+)/i);

      const stepFrom = rangeM ? parseInt(rangeM[1]) : undefined;
      const stepTo   = rangeM ? parseInt(rangeM[2]) : (toOnlyM ? parseInt(toOnlyM[1]) : undefined);
      const isResume = /reprenez|reprendre/i.test(fullCtx);

      const noteM = surrounding.match(/SANS\s+([^<.]{5,60})/i);
      const note = noteM ? `⚠️ SANS ${noteM[1].trim()}` : undefined;

      sequences.push({ ref, name: cleanName, stepFrom, stepTo, note, isResume });
    }

    if (!rawTitle && sequences.length > 0) {
      const s = sequences[0];
      rawTitle = s.stepTo
        ? `${s.name} (étapes ${s.stepFrom ?? 1}→${s.stepTo})`
        : s.name;
    }

    let description = html
      .replace(/<input[^>]*type="checkbox"[^>]*>/g, "")
      .replace(/<p[^>]*>\s*<\/p>/g, "")
      .trim();

    if (description.includes("Vous trouverez ici") || description.length < 10) {
      description = "";
    }

    if (!rawTitle && !description && sequences.length === 0) {
      skipped++;
      continue;
    }

    if (!rawTitle) rawTitle = `Étape ${order}`;

    const isBonus   = /[ée]tape\s+bonus|partie\s+bonus/i.test(html + " " + (step.name ?? ""));
    const isDofus   = /\bdofus\b/i.test(rawTitle + " " + html.substring(0, 500));
    const isDonjon  = /\bdonjon\b/i.test(rawTitle) || html.includes("tag-dungeon");

    const type        = isDofus ? "DOFUS" : isDonjon ? "DONJON" : isBonus ? "PREREQUIS" : "QUETE_SERIE";
    const accentColor = isDofus ? "#f59e0b" : isDonjon ? "#8b5cf6" : isBonus ? "#a855f7" : "#10b981";

    const firstSeq   = sequences[0];
    const gpNumMatch  = firstSeq?.ref.match(/\d+/);
    const chapterNum  = gpNumMatch ? parseInt(gpNumMatch[0]) : 0;
    const chapterLabel = firstSeq ? `[${firstSeq.ref}] ${firstSeq.name}` : "Introduction";

    // SMART MATCHING: Find if a milestone already exists at this order, or with a similar title
    const existing = existingMilestones.find(
      m => m.order === order || m.title.toLowerCase() === rawTitle?.toLowerCase()
    );

    let milestoneId: string;
    if (existing) {
      milestoneId = existing.id;
      await db.guideMilestone.update({
        where: { id: milestoneId },
        data: {
          title: rawTitle,
          description: description || null,
          type,
          chapter: chapterNum,
          chapterLabel,
          accentColor,
          order,
          isOptional: isBonus,
        }
      });
      // Delete old sequences to refresh them
      await db.guideSequence.deleteMany({ where: { milestoneId } });
      updated++;
    } else {
      const newMilestone = await db.guideMilestone.create({
        data: {
          guideId,
          title: rawTitle,
          description: description || null,
          type,
          chapter: chapterNum,
          chapterLabel,
          accentColor,
          order,
          posX: (order % 4) * 220,
          posY: Math.floor((order - 1) / 4) * 160,
          isOptional: isBonus,
        },
      });
      milestoneId = newMilestone.id;
      created++;
    }

    activeMilestoneIds.add(milestoneId);

    for (let i = 0; i < sequences.length; i++) {
      const seq = sequences[i];
      await db.guideSequence.create({
        data: {
          milestoneId,
          subGuideRef: seq.ref,
          subGuideName: seq.name,
          stepFrom: seq.stepFrom,
          stepTo: seq.stepTo,
          note: seq.note,
          isResume: seq.isResume,
          isOptional: isBonus,
          order: i + 1,
        },
      });
    }

    order++;
  }

  // Delete milestones that are no longer part of this guide
  const toDelete = existingMilestones.filter(m => !activeMilestoneIds.has(m.id));
  if (toDelete.length > 0) {
    await db.guideMilestone.deleteMany({
      where: {
        id: { in: toDelete.map(m => m.id) }
      }
    });
  }

  revalidatePath("/god/dofus-guides");
  return {
    success: true,
    created,
    updated,
    deleted: toDelete.length,
    skipped,
    noProperTitle,
    message: `✅ Import intelligent terminé. Créés : ${created}, Mis à jour : ${updated}, Supprimés : ${toDelete.length}. ${skipped} ignorés.`,
  };
}

// ---------------------------------------------------------------------------
// PIXEL-PERFECT WORLD MAP RESOLVER
// ---------------------------------------------------------------------------

let cachedWorldMap: any = null;
let cachedWorlds: any[] = [];

function loadMapData() {
  if (cachedWorldMap && cachedWorlds && cachedWorlds.length > 0) {
    return { worldMap: cachedWorldMap, worlds: cachedWorlds };
  }

  try {
    const fs = require("fs");
    const path = require("path");

    const worldMapPath = path.join(process.cwd(), "public", "game-data", "worldmap.json");
    const worldsPath = path.join(process.cwd(), "public", "game-data", "worlds.json");

    if (fs.existsSync(worldMapPath) && fs.existsSync(worldsPath)) {
      cachedWorldMap = JSON.parse(fs.readFileSync(worldMapPath, "utf8"));
      cachedWorlds = JSON.parse(fs.readFileSync(worldsPath, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load map data on server side:", e);
  }

  return { worldMap: cachedWorldMap, worlds: cachedWorlds };
}

/**
 * Resolves the precise world map ID for a given coordinate [x, y] using context matching to avoid false positives.
 */
export async function resolveMapWorldAction(x: number, y: number, textContext?: string): Promise<{ success: boolean; worldId: number }> {
  try {
    const { worldMap, worlds } = loadMapData();
    if (!worldMap || !worldMap.maps) {
      return { success: true, worldId: 1 }; // Default fallback
    }

    // Find all candidate maps matching coordinates
    const candidateMaps = worldMap.maps.filter((m: any) => m.x === x && m.y === y);

    if (candidateMaps.length === 0) {
      return { success: true, worldId: 1 };
    }

    if (candidateMaps.length === 1) {
      return { success: true, worldId: candidateMaps[0].worldMap };
    }

    // Multiple maps exist at [x, y]! Resolve ambiguity via semantic context
    const txt = (textContext || "").toLowerCase();

    // If all maps are from the same world, no ambiguity
    const candidateWorldIds = Array.from(new Set(candidateMaps.map((m: any) => m.worldMap))) as number[];
    if (candidateWorldIds.length === 1) {
      return { success: true, worldId: candidateWorldIds[0] };
    }

    let bestWorldId = candidateWorldIds[0];
    let bestScore = -1;

    for (const map of candidateMaps) {
      let score = 0;

      // 1. Subarea name matching
      const subarea = worldMap.subareas?.find((s: any) => s.id === map.subAreaId);
      if (subarea) {
        const subareaNameFr = (typeof subarea.name === "string" ? subarea.name : subarea.name?.fr || "").toLowerCase();
        const subareaNameEn = (subarea.name?.en || "").toLowerCase();

        if (subareaNameFr && txt.includes(subareaNameFr)) {
          score += 150; // Exact subarea name is a highly confident match
        } else if (subareaNameFr) {
          const words = subareaNameFr.split(/\s+/).filter((w: string) => w.length > 3);
          for (const w of words) {
            if (txt.includes(w)) {
              score += 30; // Partial word matching
            }
          }
        }

        if (subareaNameEn && txt.includes(subareaNameEn)) {
          score += 80;
        }
      }

      // 2. World name matching
      const worldObj = worlds?.find((w: any) => w.id === map.worldMap);
      if (worldObj) {
        const worldNameFr = (worldObj.name?.fr || "").toLowerCase();
        const worldNameEn = (worldObj.name?.en || "").toLowerCase();

        if (worldNameFr && txt.includes(worldNameFr)) {
          score += 200; // Perfect world name match
        }
        if (worldNameEn && txt.includes(worldNameEn)) {
          score += 100;
        }
      }

      // 3. Coordinate world ID mapping helper keywords
      if (map.worldMap === 2 && (txt.includes("incarnam") || txt.includes("débutant") || txt.includes("ganymède"))) {
        score += 180;
      }
      if (map.worldMap === 4 && (txt.includes("minotoror") || txt.includes("labyrinthe"))) {
        score += 180;
      }
      if (map.worldMap === 5 && (txt.includes("dragon cochon") || txt.includes("dragon-cochon") || txt.includes("porcos"))) {
        score += 180;
      }
      if (map.worldMap === 6 && (txt.includes("corbac") || txt.includes("bibliothèque"))) {
        score += 180;
      }
      if (map.worldMap === 7 && (txt.includes("givrefoux") || txt.includes("frigost") || txt.includes("caverne"))) {
        score += 180;
      }
      if (map.worldMap === 8 && (txt.includes("méphitique") || txt.includes("canal") || txt.includes("canaux"))) {
        score += 180;
      }
      if (map.worldMap === 9 && (txt.includes("brâkmar") || txt.includes("brakmar") || txt.includes("entrailles"))) {
        score += 180;
      }
      if (map.worldMap === 10 && (txt.includes("canopée") || txt.includes("canopee") || txt.includes("arbre klip"))) {
        score += 180;
      }

      // Default slight bias to World of Twelve if no clear match exists
      if (map.worldMap === 1) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestWorldId = map.worldMap;
      }
    }

    return { success: true, worldId: bestWorldId };
  } catch (err) {
    console.error("Failed to resolve map world:", err);
    return { success: false, worldId: 1 };
  }
}

// ─── Rush Timeline Actions ──────────────────────────────────────────────────

/**
 * (God) Toggle isUnderConstruction / displayMode sur un guide.
 */
export async function updateGuideSettings(
  guideId: string,
  data: { isUnderConstruction?: boolean; displayMode?: "TREE" | "TIMELINE"; isActive?: boolean }
) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Réservé aux Super Admins");

  const guide = await db.optimizedGuide.update({
    where: { id: guideId },
    data,
  });

  revalidatePath("/god/dofus-guides");
  return { success: true, guide };
}

/**
 * Valide TOUTES les séquences/étapes d'un milestone (bouton "Valider tout ce bloc").
 * Passe le milestone isCompleted=true et enregistre toutes ses stepKeys en completedSteps.
 */
export async function validateEntireMilestone(
  guildId: string,
  milestoneId: string,
  altPseudo?: string
) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated || !ctx.profileId) throw new Error("Non autorisé");

  let profileId = ctx.profileId;
  if (altPseudo && altPseudo !== "PRINCIPAL") {
    profileId = `${ctx.profileId}::${altPseudo}`;
  }

  // Fetch milestone sequences to build the full list of step keys
  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      sequences: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!milestone) return { success: false, error: "Milestone introuvable" };

  // Build all step keys from sequences
  const allStepKeys: string[] = [];
  for (const seq of milestone.sequences) {
    if (seq.stepFrom !== null && seq.stepTo !== null) {
      for (let i = seq.stepFrom; i <= seq.stepTo; i++) {
        allStepKeys.push(`${seq.subGuideRef}-${i}`);
      }
    } else {
      allStepKeys.push(`${seq.subGuideRef}-all`);
    }
  }

  await db.playerGuideProgress.upsert({
    where: { profileId_milestoneId: { profileId, milestoneId } },
    create: {
      profileId,
      milestoneId,
      isCompleted: true,
      completedAt: new Date(),
      completedSteps: allStepKeys,
    },
    update: {
      isCompleted: true,
      completedAt: new Date(),
      completedSteps: allStepKeys,
    },
  });

  revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  return { success: true };
}

/**
 * Retourne tous les guides avec displayMode=TIMELINE qui sont actifs.
 */
export async function getTimelineGuides(guildId: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");

  const guides = await db.optimizedGuide.findMany({
    where: { displayMode: "TIMELINE", isActive: true },
    include: {
      milestones: {
        orderBy: [{ chapter: "asc" }, { order: "asc" }],
        include: {
          sequences: { orderBy: { order: "asc" } },
          playerProgress: ctx.profileId
            ? { where: { profileId: ctx.profileId } }
            : { where: { profileId: "__NONE__" } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return { success: true, guides };
}

// ─── Rush Sylvestre God Actions ────────────────────────────────────────────────

/**
 * (God) Récupère ou crée le guide Rush Sylvestre.
 * Le guide est automatiquement créé avec displayMode=TIMELINE si absent.
 */
export async function getOrCreateRushSylvestreGuide() {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Accès réservé aux super-admins");

  let guide = await db.optimizedGuide.findUnique({
    where: { slug: "rush-sylvestre" },
    include: {
      milestones: {
        orderBy: [{ chapter: "asc" }, { order: "asc" }],
        include: {
          sequences: {
            orderBy: { order: "asc" },
            include: { dungeon: true }
          }
        },
      },
    },
  });

  if (!guide) {
    guide = await db.optimizedGuide.create({
      data: {
        slug: "rush-sylvestre",
        name: "Rush Sylvestre",
        description: "Guide communautaire de rush Dofus Sylvestre — suis ta progression étape par étape et coordonne-toi avec la guilde.",
        displayMode: "TIMELINE",
        isActive: true,
        isUnderConstruction: true,
      },
      include: {
        milestones: {
          orderBy: [{ chapter: "asc" }, { order: "asc" }],
          include: {
            sequences: {
              orderBy: { order: "asc" },
              include: { dungeon: true }
            }
          },
        },
      },
    });
  }

  return guide;
}

/**
 * (God) Met à jour les métadonnées du guide Rush Sylvestre.
 */
export async function updateRushSylvestreSettings(data: {
  name?: string;
  description?: string;
  isActive?: boolean;
  isUnderConstruction?: boolean;
}) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Accès réservé aux super-admins");

  const guide = await db.optimizedGuide.update({
    where: { slug: "rush-sylvestre" },
    data,
  });

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true, guide };
}

/**
 * (God) Upsert un chapitre (milestone) du Rush Sylvestre.
 */
export async function upsertRushMilestone(data: {
  id?: string;
  chapter: string;
  chapterLabel: string;
  label: string;
  description?: string;
  accentColor?: string;
  isOptional?: boolean;
  order?: number;
  type?: any; // GuideMilestoneType enum
  tips?: string;
  dofusId?: string | null;
}) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Accès réservé aux super-admins");

  const guide = await db.optimizedGuide.findUniqueOrThrow({ where: { slug: "rush-sylvestre" } });

  let parsedChapter = parseInt(data.chapter, 10);
  if (isNaN(parsedChapter)) {
    parsedChapter = 1;
  }

  let milestone;
  if (data.id) {
    milestone = await db.guideMilestone.update({
      where: { id: data.id },
      data: {
        chapter: parsedChapter,
        chapterLabel: data.chapterLabel,
        title: data.label,
        description: data.description,
        accentColor: data.accentColor,
        isOptional: data.isOptional ?? false,
        order: data.order ?? 0,
        type: data.type ?? undefined,
        tips: data.tips,
        dofusId: data.dofusId,
      },
      include: {
        sequences: {
          orderBy: { order: "asc" },
          include: { dungeon: true }
        }
      },
    });
  } else {
    const maxOrder = await db.guideMilestone.count({ where: { guideId: guide.id } });
    milestone = await db.guideMilestone.create({
      data: {
        guideId: guide.id,
        type: data.type ?? "QUETE_SERIE",
        chapter: parsedChapter,
        chapterLabel: data.chapterLabel,
        title: data.label,
        description: data.description,
        accentColor: data.accentColor ?? "#10b981",
        isOptional: data.isOptional ?? false,
        order: data.order ?? maxOrder,
        tips: data.tips,
        dofusId: data.dofusId,
      },
      include: {
        sequences: {
          orderBy: { order: "asc" },
          include: { dungeon: true }
        }
      },
    });
  }

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true, milestone };
}

/**
 * (God) Supprime un milestone du Rush Sylvestre.
 */
export async function deleteRushMilestone(milestoneId: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Accès réservé aux super-admins");

  await db.guideMilestone.delete({ where: { id: milestoneId } });
  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * (God) Reordonne une liste de milestones (Drag & Drop)
 */
export async function reorderRushMilestones(orderedIds: string[]) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Accès réservé aux super-admins");

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.guideMilestone.update({
        where: { id },
        data: { order: index }
      })
    )
  );

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * (God) Reordonne les séquences d'un milestone (Drag & Drop)
 */
export async function reorderRushSequences(milestoneId: string, orderedIds: string[]) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Accès réservé aux super-admins");

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.guideSequence.update({
        where: { id },
        data: { order: index, milestoneId }
      })
    )
  );

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * (God) Upsert une séquence (quête) dans un milestone Rush.
 */
export async function upsertRushSequence(data: {
  id?: string;
  milestoneId: string;
  subGuideRef: string;
  dungeonId?: string | null;
  dungeonIds?: string[];
  dofusdbUrl?: string | null;
  dofuspourlesnoobsUrl?: string | null;
  tips?: string | null;
  alignReq?: string | null;
  alignOrderReq?: number | null;
  note?: string;
  order?: number;
  isSuccess?: boolean;
  metamobMonsterId?: number | null;
  activityTags?: Array<{ type: string; name?: string; level?: number }>;
}) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Accès réservé aux super-admins");

  let seq;
  // Champs communs (sans dungeonId — géré différemment selon create/update)
  const commonFields = {
    subGuideRef: data.subGuideRef,
    subGuideName: data.subGuideRef,
    dofusdbUrl: data.dofusdbUrl,
    dofuspourlesnoobsUrl: data.dofuspourlesnoobsUrl,
    tips: data.tips,
    alignReq: data.alignReq,
    alignOrderReq: data.alignOrderReq,
    note: data.note,
    order: data.order ?? undefined,
    isSuccess: data.isSuccess ?? false,
    metamobMonsterId: data.metamobMonsterId ?? null,
    activityTags: data.activityTags ?? [],
    dungeonIds: data.dungeonIds ?? undefined,
  };

  if (data.id) {
    // UPDATE : Prisma v7 exige l'API relation pour les FK (connect/disconnect)
    seq = await db.guideSequence.update({
      where: { id: data.id },
      data: {
        ...commonFields,
        ...(data.dungeonId !== undefined
          ? { dungeon: data.dungeonId ? { connect: { id: data.dungeonId } } : { disconnect: true } }
          : {}),
      },
    });
  } else {
    // CREATE : on peut passer le scalaire dungeonId directement
    const maxOrder = await db.guideSequence.count({ where: { milestoneId: data.milestoneId } });
    seq = await db.guideSequence.create({
      data: {
        ...commonFields,
        milestoneId: data.milestoneId,
        isPartial: false,
        dungeonId: data.dungeonId ?? null,
        dungeonIds: data.dungeonIds ?? [],
        order: data.order ?? maxOrder,
      },
    });
  }

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true, sequence: seq };
}

/**
 * (God) Supprime une séquence Rush.
 */
export async function deleteRushSequence(sequenceId: string) {
  const isGod = await isSuperAdmin();
  if (!isGod) throw new Error("Accès réservé aux super-admins");

  await db.guideSequence.delete({ where: { id: sequenceId } });
  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true };
}
