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

/**
 * Récupère un guide spécifique avec les détails de toutes les quêtes référencées.
 */
export async function getOptimizedGuideDetail(slug: string, guildId: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");

  const guide = await db.optimizedGuide.findUnique({
    where: { slug },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!guide) return { success: false, error: "Guide introuvable" };

  // Collect all DofusQuestEntry IDs from all steps (looking at both questIds legacy and objectives)
  const allQuestIds = guide.steps.flatMap((step: any) => {
    const qids = step.questIds || [];
    const objQids = (step.objectives as any[])?.filter(o => o.type === 'QUEST').map(o => o.id) || [];
    return [...new Set([...qids, ...objQids])];
  });
  
  // Fetch detailed quests with their respective Dofus chain information
  const questsDetail = await db.dofusQuestEntry.findMany({
    where: { id: { in: allQuestIds } },
    include: {
      chain: {
        include: {
          dofus: true,
        },
      },
      playerProgress: {
        where: {
          profileId: ctx.id,
          characterName: "PRINCIPAL",
        },
      },
    },
  });

  return { success: true, guide, questsDetail };
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
    if (guildId) revalidatePath(`/dashboard/${guildId}/quetes-dofus/routes/${guideData.slug}`);
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
 */
export async function getGuildOptimizedGuideProgress(slug: string, guildId: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");

  const guide = await db.optimizedGuide.findUnique({
    where: { slug },
    include: {
      steps: { orderBy: { order: "asc" } },
    },
  });

  if (!guide) return { success: false, error: "Guide introuvable" };

  const allQuestIds = guide.steps.flatMap((step: any) => {
    const qids = step.questIds || [];
    const objQids = (step.objectives as any[])?.filter(o => o.type === 'QUEST').map(o => o.id) || [];
    return [...new Set([...qids, ...objQids])];
  });
  if (allQuestIds.length === 0) return { success: true, memberProgress: [] };

  // Récupérer toutes les quêtes complétées pour ce guide
  const allCompletedQuests = await db.playerDofusQuestProgress.findMany({
    where: {
      guildId,
      questId: { in: allQuestIds },
      characterName: "PRINCIPAL",
      status: "COMPLETED",
    },
    include: {
      profile: {
        include: { user: true },
      },
    },
  });

  // Grouper par profile
  const progressByProfile = new Map<string, { profile: any; completedIds: Set<string> }>();
  for (const progress of allCompletedQuests) {
    if (!progressByProfile.has(progress.profileId)) {
      progressByProfile.set(progress.profileId, {
        profile: progress.profile,
        completedIds: new Set(),
      });
    }
    progressByProfile.get(progress.profileId)!.completedIds.add(progress.questId);
  }

  // Déterminer l'étape pour chaque profile
  const memberProgress: {
    profile: any;
    currentStepIndex: number; // 0 = Etape 1, -1 = Fini
    isFinished: boolean;
  }[] = [];

  for (const [_, data] of progressByProfile.entries()) {
    let currentStepIndex = 0;
    let isFinished = false;

    // Itérer sur les étapes dans l'ordre pour trouver la première non complétée à 100%
    for (const [idx, step] of guide.steps.entries()) {
      const stepQuestIds = [
        ...(step.questIds || []),
        ...((step.objectives as any[])?.filter(o => o.type === 'QUEST').map(o => o.id) || [])
      ];
      const uniqueStepQuests = [...new Set(stepQuestIds)];
      if (uniqueStepQuests.length === 0) continue;

      const hasMissingQuest = uniqueStepQuests.some((qid) => !data.completedIds.has(qid));
      if (hasMissingQuest) {
        currentStepIndex = idx;
        break;
      }

      // Si on arrive à la dernière étape et pas de missing quests, c'est fini
      if (idx === guide.steps.length - 1 && !hasMissingQuest) {
        currentStepIndex = idx;
        isFinished = true;
      }
    }

    memberProgress.push({
      profile: data.profile,
      currentStepIndex,
      isFinished,
    });
  }

  return { success: true, memberProgress };
}
