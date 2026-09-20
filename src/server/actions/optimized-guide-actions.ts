"use server";
// Force reload after schema update


import { db } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";
import { getUserContext } from "./user-actions";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "./super-admin-actions";
import { createGodAuditLog, type AuditAction, type AuditTargetType } from "./audit-actions";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { publishGuideEvent, parseStepKey, getCachedGuideProgress, invalidateGuideProgressCache } from "@/lib/guide-realtime";
import { buildGuildProgressRows, buildPresenceMap, buildUniqueGuildMembers, buildMilestoneStepKeys, type GuideProgressRow, type GuideProgressMember, type GuidePresenceMap } from "@/lib/guide-progress-helpers";
import { z } from "zod";
import { findSequenceHelpers, type RushHelperProfile, type RushHelperMetier } from "@/lib/rush-helpers";
import { normalizeMetiers } from "@/lib/metiers";
import type { RushSequence } from "@/types/rush-guide-types";

/**
 * 🛡️ Trace une écriture God UNIQUEMENT si l'acteur est un sous-god (pas super-admin).
 * Évite le double-log pour l'admin (qui passe déjà par d'autres traces).
 * Fail-closed côté log : n'interrompt jamais l'action applicative si le log échoue.
 */
async function logGodWrite({
    action,
    targetType,
    targetId,
    metadata,
}: {
    action: AuditAction;
    targetType: AuditTargetType;
    targetId?: string;
    metadata?: Record<string, any>;
}) {
    try {
        const isGod = await isSuperAdmin();
        if (isGod) return; // l'admin est déjà tracé par d'autres canaux
        await createGodAuditLog({ action, targetType, targetId, metadata });
    } catch (error) {
        logger.error("[logGodWrite] Échec du traçage (non bloquant)", { error });
    }
}

/**
 * 🛡️ Guard fail-closed local : autorise super-admin OU grant/scope sur la brique.
 * Permet à un sous-god de gérer les guides optimisés (brique game-data-guides).
 */
async function requireGuideAccess() {
  const isGod = await isSuperAdmin();
  if (isGod) return true;
  const ok = await canAccessBrick("game-data-guides");
  if (!ok) throw new Error("Accès non autorisé à ce module");
  return true;
}

/**
 * Guard admin God + RATE LIMIT (P1-4) : protège les écritures lourdes
 * (import JSON, upsert, delete bulk) contre le spam. Fail-closed via Redis.
 */
async function requireGuideWriteAccess(scope: string, limit = 20, windowMs = 60_000) {
  await requireGuideAccess();
  const session = await auth();
  const uid = session?.user?.id || "anon";
  const { success } = await rateLimit(`guide-admin-${scope}:${uid}`, limit, windowMs);
  if (!success) throw new Error("Trop de requêtes, veuillez patienter.");
}

/**
 * 🛡️ Guard fail-closed local : autorise super-admin OU grant/scope sur la brique Rush.
 */
async function requireRushAccess() {
  const isGod = await isSuperAdmin();
  if (isGod) return true;
  const ok = await canAccessBrick("game-data-rush");
  if (!ok) throw new Error("Accès non autorisé à ce module");
  return true;
}

/**
 * Résout le profileId et characterSlot à utiliser pour les actions de progression.
 * Lorsqu'un altPseudo est fourni, on utilise un characterSlot pour distinguer
 * la progression du personnage principal (characterSlot = null) 
 * de celle d'un personnage alternatif (characterSlot = altPseudo),
 * tout en gardant l'intégrité de la clé étrangère profileId -> UserProfile.
 */
function resolvePlayerProgressKey(profileId: string, altPseudo?: string): { profileId: string; characterSlot: string } {
  if (altPseudo && altPseudo !== "PRINCIPAL") {
    return { profileId, characterSlot: altPseudo };
  }
  return { profileId, characterSlot: "PRINCIPAL" };
}

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
    orderBy: { createdAt: "asc" },
  });

  return { success: true, guides };
}

/**
 * (HUD guide) Liste LÉGÈRE des guides pour le sélecteur de guide.
 * Même auth que getOptimizedGuides (admin = tous, membre = actifs), mais
 * ne sélectionne que les champs nécessaires (pas les steps — payload léger).
 */
export async function getOptimizedGuidesLite(guildId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const isGod = await isSuperAdmin();
  let isAdmin = isGod;
  if (!isGod && guildId) {
    const ctx = await getUserContext(guildId);
    isAdmin = ctx.isAdmin;
  }

  const guides = await db.optimizedGuide.findMany({
    where: isAdmin ? {} : { isActive: true },
    select: { id: true, slug: true, name: true, displayMode: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return { success: true, guides };
}

/**
 * 🌐 Version publique de lecture d'un guide optimisé (0-login, sans guildId ni profil).
 * Lit le catalogue maître sans toucher aux données membres ni écrire en base.
 */
export async function getPublicGuideDetail(slug: string) {
  if (!slug || typeof slug !== "string") {
    return { success: false, error: "Slug invalide" };
  }

  const guide = await db.optimizedGuide.findUnique({
    where: { slug },
    include: {
      milestones: {
        orderBy: { order: "asc" },
        include: {
          sequences: {
            orderBy: { order: "asc" },
            include: { dungeon: true },
          },
        },
      },
    },
  });

  if (!guide) return { success: false, error: "Guide introuvable" };

  // Resolve all dungeons from dungeonIds for each sequence
  const allDungeonIds = new Set<string>();
  for (const ms of guide.milestones) {
    for (const seq of ms.sequences) {
      if (Array.isArray((seq as any).dungeonIds)) {
        for (const did of (seq as any).dungeonIds) {
          if (did) allDungeonIds.add(did);
        }
      }
    }
  }
  if (allDungeonIds.size > 0) {
    const dungeons = await db.dungeon.findMany({
      where: { id: { in: Array.from(allDungeonIds) } },
      select: { id: true, name: true, bossName: true, imageUrl: true, level: true },
    });
    const dungeonMap = new Map(dungeons.map((d) => [d.id, d]));
    for (const ms of guide.milestones) {
      for (const seq of ms.sequences) {
        const ids = (seq as any).dungeonIds as string[] | undefined;
        if (ids && ids.length > 0) {
          (seq as any).dungeons = ids.map((id) => dungeonMap.get(id)).filter(Boolean);
        }
      }
    }
  }

  return { success: true, guide };
}

export async function getOptimizedGuideDetail(slug: string, guildId: string, altPseudo?: string) {

  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");

  if (!ctx.profileId) return { success: false, error: "Profile non trouvé" };

  // Use characterSlot to distinguish main vs. alt character progress
  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

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
          playerProgress: profileId
            ? { where: { profileId, characterSlot } }
            : { where: { profileId: "__NONE__" } },
        }
      }
    },
  });

  if (!guide) return { success: false, error: "Guide introuvable" };

  // Resolve all dungeons from dungeonIds for each sequence
  const allDungeonIds = new Set<string>();
  for (const ms of guide.milestones) {
    for (const seq of ms.sequences) {
      if (Array.isArray((seq as any).dungeonIds)) {
        for (const did of (seq as any).dungeonIds) {
          if (did) allDungeonIds.add(did);
        }
      }
    }
  }
  if (allDungeonIds.size > 0) {
    const dungeons = await db.dungeon.findMany({
      where: { id: { in: Array.from(allDungeonIds) } },
      select: { id: true, name: true, bossName: true, imageUrl: true, level: true }
    });
    const dungeonMap = new Map(dungeons.map(d => [d.id, d]));
    for (const ms of guide.milestones) {
      for (const seq of ms.sequences) {
        const ids = (seq as any).dungeonIds as string[] | undefined;
        if (ids && ids.length > 0) {
          (seq as any).dungeons = ids.map(id => dungeonMap.get(id)).filter(Boolean);
        }
      }
    }
  }

  // ── Normalisation Rush : exposer `completedStepIds` & `bookmarkedSeqId` (seq-id) ──
  // Le module Rush raisonne par `seq.id` ; la base stocke `completedSteps` / `currentStep`
  // (seq-ids pour Rush ; step-keys Ganymède `GPx-N` pour le legacy/Duffus). On projette
  // une vue seq-id sur `playerProgress[0]` pour que l'overlay et le dashboard lisent
  // correctement l'état coché / repère (sinon `completedStepIds` était `undefined`).
  const isInfoSeqLocal = (seq: any) =>
    Array.isArray(seq?.activityTags) && (seq.activityTags as any[]).some((t: any) => t.type === "info_sequence");

  for (const ms of guide.milestones) {
    const stepKeyToSeq = new Map<string, string>();
    const seqIdSet = new Set<string>();
    for (const seq of ms.sequences || []) {
      seqIdSet.add(seq.id);
      for (const key of buildMilestoneStepKeys([seq])) {
        if (!stepKeyToSeq.has(key)) stepKeyToSeq.set(key, seq.id);
      }
    }
    const resolveSeqId = (raw: unknown): string | null => {
      if (raw == null) return null;
      const key = String(raw);
      const id = key.startsWith("seq:") ? key.slice(4) : (stepKeyToSeq.get(key) ?? key);
      return seqIdSet.has(id) ? id : null;
    };
    for (const pp of (ms as any).playerProgress || []) {
      const resolvedSteps: string[] = [];
      const completed = Array.isArray((pp as any).completedSteps) ? (pp as any).completedSteps : [];
      for (const c of completed) {
        const id = resolveSeqId(c);
        if (!id) continue;
        const seq = (ms.sequences || []).find((s: any) => s.id === id);
        if (seq && !isInfoSeqLocal(seq)) resolvedSteps.push(id);
      }
      (pp as any).completedStepIds = [...new Set(resolvedSteps)];
      (pp as any).bookmarkedSeqId = resolveSeqId((pp as any).currentStep);
    }
  }

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
 * Résultat agrégé de la progression d'une guilde sur un guide (Phase I + cache Redis P0).
 * `allProgress`/`uniqueGuildMembers`/`presenceMap` absents quand `success=false`.
 */
export type GuildGuideProgressResult = {
  success: boolean;
  allProgress?: GuideProgressRow[];
  uniqueGuildMembers?: GuideProgressMember[];
  presenceMap?: GuidePresenceMap;
  error?: string;
};

/**
 * Calcule à quelle étape de la route se trouve chaque membre de la guilde.
 * Basé sur les PlayerGuideProgress.
 */
export async function getGuildOptimizedGuideProgress(slug: string, guildId: string): Promise<GuildGuideProgressResult> {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");

  const guide = await db.optimizedGuide.findUnique({
    where: { slug },
    select: {
      id: true,
      milestones: { select: { id: true, order: true }, orderBy: { order: "asc" } },
    },
  });

  if (!guide) return { success: false, error: "Guide introuvable" };

  // Phase I — Agrégation serveur (AUDIT-MILITAIRE §2.1) : select chirurgical au lieu
  // du `include profile { include user }` qui sérialisait profil + user complets
  // (5 000 à 15 000 lignes) vers le client. On renvoie uniquement :
  //   - allProgress        : lignes allégées (shape client inchangée) ;
  //   - uniqueGuildMembers : membres agrégés par profileId ;
  //   - presenceMap        : carte milestoneId → membres présents.
  // Cache Redis court (multi-guilde × centaines d'utilisateurs) : l'agrégat complet
  // n'est recalculé qu'une fois toutes les ~3s par (guildId, slug), au lieu d'un
  // findMany de TOUTES les progressions de la guilde à chaque page view (P0).
  return getCachedGuideProgress(guildId, slug, async () => {
    const rawRows = await db.playerGuideProgress.findMany({
      where: {
        milestone: { guideId: guide.id },
        profile: { guild: { discordGuildId: guildId } }
      },
      select: {
        profileId: true,
        milestoneId: true,
        characterSlot: true,
        isCompleted: true,
        completedSteps: true,
        currentStep: true,
        profile: {
          select: {
            pseudoDofus: true,
            alignment: true,
            alignmentOrder: true,
            alignmentLevel: true,
            altPseudos: true,
            user: { select: { name: true, image: true } },
          },
        },
      },
    });

    const allProgress = buildGuildProgressRows(rawRows);
    const uniqueGuildMembers = buildUniqueGuildMembers(allProgress, guide.milestones);
    const presenceMap = buildPresenceMap(uniqueGuildMembers);

    return { success: true, allProgress, uniqueGuildMembers, presenceMap };
  });
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
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

  // 🛡️ RATE LIMIT (P0) : 30 toggle/min par membre.
  const { success: rateOk } = await rateLimit(`guide-toggle:${ctx.profileId}`, 30, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  const milestoneWithSequences = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: {
      title: true,
      sequences: {
        select: { id: true }
      },
      guide: { select: { slug: true } }
    }
  });

  const completedSteps = isCompleted ? (milestoneWithSequences?.sequences.map((seq) => seq.id) ?? []) : [];

  const progress = await db.playerGuideProgress.upsert({
    where: {
      profileId_milestoneId_characterSlot: { profileId, milestoneId, characterSlot }
    },
    update: {
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      completedSteps,
    },
    create: {
      profileId,
      milestoneId,
      characterSlot,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      completedSteps,
    }
  });

  // Temps réel (Phase E) : broadcast « jalon complété » — fail-closed, non bloquant.
  if (isCompleted && milestoneWithSequences?.guide?.slug) {
    await publishGuideEvent(guildId, milestoneWithSequences.guide.slug, {
      type: "milestone:completed",
      profileId,
      userName: ctx.name || "Membre",
      milestoneId,
      milestoneTitle: milestoneWithSequences.title || "Jalon",
    });
  }

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: { guide: { select: { slug: true } } }
  });
  if (milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
    await invalidateGuideProgressCache(guildId, milestone.guide.slug);
  }

  revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  return { success: true, progress };
}

/**
 * Réinitialise la progression d'un milestone (étapes + validation + marque-page).
 */
export async function resetMilestoneProgress(guildId: string, milestoneId: string, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

  // 🛡️ RATE LIMIT (P0) : 15 reset jalon/min par membre.
  const { success: rateOk } = await rateLimit(`guide-reset-ms:${ctx.profileId}`, 15, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  // Delete the progress record entirely (cleaner than zeroing out)
  await db.playerGuideProgress.deleteMany({
    where: { profileId, milestoneId, characterSlot }
  });

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: { guide: { select: { slug: true } } }
  });
  if (milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
    await invalidateGuideProgressCache(guildId, milestone.guide.slug);
  }
  revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  return { success: true };
}

/**
 * Réinitialise toute la progression d'un guide pour l'utilisateur courant.
 */
export async function resetGuideProgress(guildId: string, guideId: string, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

  // 🛡️ RATE LIMIT (P0) : 5 reset guide/min par membre.
  const { success: rateOk } = await rateLimit(`guide-reset-guide:${ctx.profileId}`, 5, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  // Fetch all milestone IDs for this guide
  const milestones = await db.guideMilestone.findMany({
    where: { guideId },
    select: { id: true }
  });
  const milestoneIds = milestones.map(m => m.id);

  if (milestoneIds.length > 0) {
    await db.playerGuideProgress.deleteMany({
      where: { profileId, characterSlot, milestoneId: { in: milestoneIds } }
    });
  }

  // Also look up guide slug for cache invalidation
  const guide = await db.optimizedGuide.findUnique({
    where: { id: guideId },
    select: { slug: true }
  });
  if (guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${guide.slug}`);
    await invalidateGuideProgressCache(guildId, guide.slug);
  }
  revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  return { success: true };
}

/**
 * Valide TOUT le guide d'un coup pour l'utilisateur courant :
 * marque chaque milestone comme complété (isCompleted + completedSteps = toutes ses séquences).
 * Miroir de `resetGuideProgress` — même auth/guild isolation, aucun autre comportement modifié.
 */
export async function completeGuideProgress(guildId: string, guideId: string, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

  // 🛡️ RATE LIMIT (P0) : 5 completions guide/min par membre.
  const { success: rateOk } = await rateLimit(`guide-complete:${ctx.profileId}`, 5, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  // Fetch all milestones with their sequences for this guide
  const milestones = await db.guideMilestone.findMany({
    where: { guideId },
    select: {
      id: true,
      sequences: { select: { id: true } }
    }
  });

  // Upsert each milestone as completed (batched in a single transaction)
  await db.$transaction(
    milestones.map((m) =>
      db.playerGuideProgress.upsert({
        where: {
          profileId_milestoneId_characterSlot: { profileId, milestoneId: m.id, characterSlot }
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
          completedSteps: m.sequences.map((s) => s.id)
        },
        create: {
          profileId,
          milestoneId: m.id,
          characterSlot,
          isCompleted: true,
          completedAt: new Date(),
          completedSteps: m.sequences.map((s) => s.id)
        }
      })
    )
  );

  // Also look up guide slug for cache invalidation
  const guide = await db.optimizedGuide.findUnique({
    where: { id: guideId },
    select: { slug: true }
  });
  if (guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${guide.slug}`);
    await invalidateGuideProgressCache(guildId, guide.slug);
  }
  revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  return { success: true };
}

/**
 * Met à jour les étapes individuelles cochées pour un milestone.
 */
export async function updateStepProgress(guildId: string, milestoneId: string, completedSteps: string[], altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

  // 🛡️ RATE LIMIT (P0) : 120 validations d'étapes/min par membre.
  const { success: rateOk } = await rateLimit(`guide-step-write:${ctx.profileId}`, 120, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  // Validation + borne des clés d'étapes (anti-payload géant / clés arbitraires).
  // Format attendu `GPx-N` (subGuideRef-numéro). Max 500 clés par appel.
  const STEP_KEY_RE = /^[A-Za-z0-9_]+-\d+$/;
  const validSteps = Array.isArray(completedSteps)
    ? completedSteps
        .filter((k): k is string => typeof k === "string" && k.length <= 64 && STEP_KEY_RE.test(k))
        .slice(0, 500)
    : [];

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: {
      guide: { select: { slug: true } },
      sequences: { select: { id: true, subGuideRef: true, stepFrom: true, stepTo: true, activityTags: true } }
    }
  });

  // Temps réel (Phase E) : on a besoin de l'état précédent pour diffuser
  // uniquement les étapes NOUVELLEMENT cochées (jamais un snapshot complet).
  const existingProgress = await db.playerGuideProgress.findUnique({
    where: { profileId_milestoneId_characterSlot: { profileId, milestoneId, characterSlot } },
    select: { completedSteps: true }
  });
  const previousKeys = new Set((existingProgress?.completedSteps as string[] | undefined) ?? []);

  // Exclude info_sequence from completion count (they are decorative banners, not checkable quests)
  const isInfoSeq = (seq: { id: string; activityTags?: any }) =>
    Array.isArray(seq.activityTags) && seq.activityTags.some((t: any) => t.type === "info_sequence");
  const regularSeqs = milestone?.sequences.filter(s => !isInfoSeq(s)) || [];
  const totalSeqCount = regularSeqs.length;

  // Étapes réelles des sous-guides SANS bornes (stepFrom/stepTo) — nécessaires pour
  // décider si toutes leurs étapes sont cochées (le jalon se complète alors automatiquement).
  const unboundedRefs = [...new Set(regularSeqs.filter(s => !s.stepFrom || !s.stepTo).map(s => s.subGuideRef))];
  const stepsByRef: Record<string, number[]> = {};
  if (unboundedRefs.length > 0) {
    const subGuides = await db.subGuideData.findMany({ where: { guideRef: { in: unboundedRefs } } });
    for (const sg of subGuides) {
      const arr = Array.isArray(sg.steps) ? (sg.steps as unknown[]) : [];
      stepsByRef[sg.guideRef] = arr
        .map((s: any) => s?.stepNumber)
        .filter((n: unknown): n is number => typeof n === "number");
    }
  }

  // Un jalon est COMPLÉTÉ quand toutes les étapes de tous ses sous-guides sont cochées
  // (fix : on comparait des IDs de séquences aux clés des étapes → toujours faux → 0/N).
  const checkedSet = new Set(validSteps);
  const isSeqFullyChecked = (seq: { subGuideRef: string; stepFrom?: number | null; stepTo?: number | null }): boolean => {
    if (seq.stepFrom && seq.stepTo) {
      for (let n = seq.stepFrom; n <= seq.stepTo; n++) {
        if (!checkedSet.has(`${seq.subGuideRef}-${n}`)) return false;
      }
      return true;
    }
    const stepNumbers = stepsByRef[seq.subGuideRef];
    if (!stepNumbers || stepNumbers.length === 0) return false;
    return stepNumbers.every(n => checkedSet.has(`${seq.subGuideRef}-${n}`));
  };
  const isAllCompleted = totalSeqCount > 0 && regularSeqs.every(isSeqFullyChecked);

  const progress = await db.playerGuideProgress.upsert({
    where: {
      profileId_milestoneId_characterSlot: { profileId, milestoneId, characterSlot }
    },
    update: {
      completedSteps: validSteps,
      isCompleted: isAllCompleted,
      completedAt: isAllCompleted ? new Date() : null
    },
    create: {
      profileId,
      milestoneId,
      characterSlot,
      completedSteps: validSteps,
      isCompleted: isAllCompleted,
      completedAt: isAllCompleted ? new Date() : null
    }
  });

  // Temps réel (Phase E) : diff sur les étapes nouvellement cochées.
  if (milestone?.guide?.slug) {
    const addedByRef = new Map<string, string[]>();
    validSteps.forEach(k => {
      if (previousKeys.has(k)) return;
      const parsed = parseStepKey(k);
      if (!parsed) return;
      const list = addedByRef.get(parsed.subGuideRef) ?? [];
      list.push(k);
      addedByRef.set(parsed.subGuideRef, list);
    });
    for (const [subGuideRef, keys] of addedByRef) {
      if (keys.length === 1) {
        const parsed = parseStepKey(keys[0])!;
        await publishGuideEvent(guildId, milestone.guide.slug, {
          type: "step:validated",
          profileId,
          userName: ctx.name || "Membre",
          userAvatar: ctx.image,
          subGuideRef,
          stepNumber: parsed.stepNumber,
        });
      } else {
        await publishGuideEvent(guildId, milestone.guide.slug, {
          type: "step:validated:batch",
          profileId,
          userName: ctx.name || "Membre",
          subGuideRef,
          count: keys.length,
        });
      }
    }
  }

  if (milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
    await invalidateGuideProgressCache(guildId, milestone.guide.slug);
  }

  revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  return { success: true, progress, isCompleted: isAllCompleted };
}

/**
 * Met à jour l'étape active/marque-page pour un milestone (J'en suis là).
 */
export async function updateBookmarkedStep(guildId: string, milestoneId: string, stepKey: string | null, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

  // 🛡️ RATE LIMIT (P0) : 30 marque-pages/min par membre.
  const { success: rateOk } = await rateLimit(`guide-bookmark:${ctx.profileId}`, 30, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  const progress = await db.playerGuideProgress.upsert({
    where: {
      profileId_milestoneId_characterSlot: { profileId, milestoneId, characterSlot }
    },
    update: {
      currentStep: stepKey 
    },
    create: {
      profileId,
      milestoneId,
      characterSlot,
      currentStep: stepKey,
      isCompleted: false
    }
  });

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: { guide: { select: { slug: true } } }
  });
  // Temps réel (Phase E) : « J'en suis là » positionne le membre sur le jalon
  // (presence:join) ; retirer le marque-page le retire (presence:leave).
  if (milestone?.guide?.slug) {
    if (stepKey) {
      await publishGuideEvent(guildId, milestone.guide.slug, {
        type: "presence:join",
        profileId,
        userName: ctx.name || "Membre",
        userAvatar: ctx.image,
        milestoneId,
      });
    } else {
      await publishGuideEvent(guildId, milestone.guide.slug, {
        type: "presence:leave",
        profileId,
        milestoneId,
      });
    }
  }

  if (milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
    await invalidateGuideProgressCache(guildId, milestone.guide.slug);
  }

  return { success: true, progress };
}

/**
 * Action Rush dédiée : valide des séquences par leur ID (pas par step-keys Ganymède).
 * Le module Rush stocke les séquences par `seq.id` ; `updateStepProgress` (partagé avec
 * Duffus) filtre en `GPx-N` et casserait la persistance. Ici on écrit les seq-ids bruts
 * et on calcule la complétion du jalon contre ses séquences de contenu (hors info).
 */
export async function setRushSequenceProgress(guildId: string, milestoneId: string, seqIds: string[], altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

  // 🛡️ RATE LIMIT (P0) : 120 validations d'étapes/min par membre.
  const { success: rateOk } = await rateLimit(`guide-step-write:${ctx.profileId}`, 120, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: {
      title: true,
      type: true,
      guide: { select: { slug: true } },
      sequences: { select: { id: true, activityTags: true } },
    },
  });
  if (!milestone) throw new Error("Jalon introuvable");
  if (["SEPARATEUR", "INFO", "DOFUS_OBTAINED"].includes(milestone.type || "")) {
    throw new Error("Ce jalon n'est pas cochable");
  }

  const isInfoSeq = (seq: { id: string; activityTags?: any }) =>
    Array.isArray(seq.activityTags) && seq.activityTags.some((t: any) => t.type === "info_sequence");

  const contentIds = (milestone.sequences || []).filter((s) => !isInfoSeq(s)).map((s) => s.id);
  const contentSet = new Set(contentIds);
  const incoming = Array.isArray(seqIds)
    ? [...new Set(seqIds.filter((id): id is string => typeof id === "string" && contentSet.has(id)))].slice(0, 500)
    : [];
  const checkedSet = new Set(incoming);
  const isCompleted = contentIds.length > 0 && contentIds.every((id) => checkedSet.has(id));

  const progress = await db.playerGuideProgress.upsert({
    where: { profileId_milestoneId_characterSlot: { profileId, milestoneId, characterSlot } },
    update: { completedSteps: incoming, isCompleted, completedAt: isCompleted ? new Date() : null },
    create: { profileId, milestoneId, characterSlot, completedSteps: incoming, isCompleted, completedAt: isCompleted ? new Date() : null },
  });

  // Temps réel + cache (fail-closed, non bloquant).
  try {
    if (milestone.guide?.slug) {
      if (isCompleted) {
        await publishGuideEvent(guildId, milestone.guide.slug, {
          type: "milestone:completed",
          profileId,
          userName: ctx.name || "Membre",
          milestoneId,
          milestoneTitle: milestone.title || "Jalon",
        });
      }
      revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
      await invalidateGuideProgressCache(guildId, milestone.guide.slug);
    }
    revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  } catch (e) {
    logger.error("[setRushSequenceProgress] post-write failed (non blocking)", { error: e });
  }

  return { success: true, isCompleted, completedStepIds: incoming, completedCount: incoming.length, totalContent: contentIds.length };
}

/**
 * Action Rush dédiée : pose/retire le repère « je suis ici » sur une séquence par son ID.
 * Stocke le seq-id brut (cohérent entre dashboard et overlay), contrairement aux formats
 * `seq:<id>` / step-key qui ne se synchronisaient pas.
 */
export async function setRushBookmark(guildId: string, milestoneId: string, seqId: string | null, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);

  // 🛡️ RATE LIMIT (P0) : 30 marque-pages/min par membre.
  const { success: rateOk } = await rateLimit(`guide-bookmark:${ctx.profileId}`, 30, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  const milestone = await db.guideMilestone.findUnique({
    where: { id: milestoneId },
    select: {
      guide: { select: { slug: true } },
      sequences: { select: { id: true, activityTags: true } },
    },
  });

  const isInfoSeq = (seq: { id: string; activityTags?: any }) =>
    Array.isArray(seq.activityTags) && seq.activityTags.some((t: any) => t.type === "info_sequence");

  let resolved: string | null = null;
  if (seqId) {
    const seq = (milestone?.sequences || []).find((s) => s.id === seqId);
    if (seq && !isInfoSeq(seq)) resolved = seq.id;
  }

  const progress = await db.playerGuideProgress.upsert({
    where: { profileId_milestoneId_characterSlot: { profileId, milestoneId, characterSlot } },
    update: { currentStep: resolved },
    create: { profileId, milestoneId, characterSlot, currentStep: resolved, isCompleted: false },
  });

  // Temps réel + cache (fail-closed, non bloquant).
  try {
    if (milestone?.guide?.slug) {
      if (resolved) {
        await publishGuideEvent(guildId, milestone.guide.slug, {
          type: "presence:join",
          profileId,
          userName: ctx.name || "Membre",
          userAvatar: ctx.image,
          milestoneId,
        });
      } else {
        await publishGuideEvent(guildId, milestone.guide.slug, {
          type: "presence:leave",
          profileId,
          milestoneId,
        });
      }
      revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${milestone.guide.slug}`);
      await invalidateGuideProgressCache(guildId, milestone.guide.slug);
    }
  } catch (e) {
    logger.error("[setRushBookmark] post-write failed (non blocking)", { error: e });
  }

  return { success: true, bookmarkedSeqId: resolved };
}

/**
 * ── S4 « quête d'alignement » — applique / restaure l'alignement du perso ──
 * Quand un membre COCHE une quête marquée `alignment_set`, son alignement de
 * rush (perso principal ou mule) est écrasé par le camp + niveau du tag.
 * Quand il DÉCOCHE, on restaure l'alignement « manuel » mémorisé
 * (`alignmentBefore`) — ou 0/neutre s'il n'y en avait pas.
 * Écriture 100 % côté serveur : garde guilde + Zod + rate-limit (fail-closed).
 */
/**
 * Trouve la dernière quête d'alignement ENCORE cochée pour un perso (chaîne
 * linéaire 1..N). Retourne le camp+niveau à appliquer, ou null si aucune
 * quête d'alignement ne reste cochée (on retombe alors sur la base).
 * Position = milestone.order * 10000 + seq.order (ordre de progression guide).
 */
async function findLastCheckedAlignmentQuest(
  profileId: string,
  characterSlot: string,
  guideSlug: string | undefined,
  excludeSequenceId: string
): Promise<{ camp: string; level: number } | null> {
  if (!guideSlug) return null;
  const rows = await db.playerGuideProgress.findMany({
    where: { profileId, characterSlot, milestone: { guide: { slug: guideSlug } } },
    select: {
      isCompleted: true,
      completedSteps: true,
      milestone: {
        select: {
          order: true,
          sequences: { select: { id: true, order: true, activityTags: true } },
        },
      },
    },
  });

  const candidates: { pos: number; camp: string; level: number }[] = [];
  for (const row of rows) {
    const checked = new Set<string>(
      row.isCompleted
        ? row.milestone.sequences.map((s) => s.id)
        : (Array.isArray(row.completedSteps) ? (row.completedSteps as string[]) : [])
    );
    for (const seq of row.milestone.sequences) {
      if (seq.id === excludeSequenceId) continue;
      if (!checked.has(seq.id)) continue;
      const tag = ((Array.isArray(seq.activityTags) ? seq.activityTags : []) as any[]).find(
        (t: any) => t.type === "alignment_set"
      );
      if (!tag?.name) continue;
      candidates.push({
        pos: row.milestone.order * 10000 + seq.order,
        camp: String(tag.name),
        level: typeof tag.level === "number" ? Math.max(0, Math.min(100, tag.level)) : 0,
      });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.pos - a.pos);
  return { camp: candidates[0].camp, level: candidates[0].level };
}

export async function applyRushAlignmentFromSequence(
  guildId: string,
  sequenceId: string,
  isChecked: boolean,
  altPseudo?: string
) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { success: rateOk } = await rateLimit(`guide-alignment:${ctx.profileId}`, 30, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  const sequence = await db.guideSequence.findUnique({
    where: { id: sequenceId },
    select: { id: true, activityTags: true, milestone: { select: { guide: { select: { slug: true } } } } },
  });
  if (!sequence) return { success: false, error: "Quête introuvable" };

  const alignmentTag = ((Array.isArray(sequence.activityTags) ? sequence.activityTags : []) as any[]).find(
    (t: any) => t.type === "alignment_set"
  );
  // Pas une quête d'alignement → no-op (aucun effet).
  if (!alignmentTag?.name) return { success: true, noop: true };

  const camp = String(alignmentTag.name);
  const level = typeof alignmentTag.level === "number" ? Math.max(0, Math.min(100, alignmentTag.level)) : 0;

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);
  const isMule = characterSlot !== "PRINCIPAL";

  const profile = await db.userProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      guildId: true,
      alignment: true,
      alignmentOrder: true,
      alignmentLevel: true,
      alignmentBefore: true,
      altPseudos: true,
    },
  });
  if (!profile) return { success: false, error: "Profil introuvable" };

  try {
    if (isMule) {
      const alts = Array.isArray(profile.altPseudos) ? [...(profile.altPseudos as any[])] : [];
      const idx = alts.findIndex((m: any) => m.pseudo === characterSlot);
      if (idx === -1) return { success: false, error: "Mule introuvable" };
      const mule = { ...alts[idx] };
      if (isChecked) {
        if (!mule.alignmentBefore) {
          mule.alignmentBefore = {
            alignment: mule.alignment ?? null,
            alignmentOrder: mule.alignmentOrder ?? null,
            alignmentLevel: mule.alignmentLevel ?? 0,
          };
        }
        mule.alignment = camp;
        mule.alignmentLevel = level;
        mule.alignmentOrder = null;
      } else {
        const last = await findLastCheckedAlignmentQuest(
          profileId,
          characterSlot,
          sequence.milestone?.guide?.slug,
          sequenceId
        );
        if (last) {
          mule.alignment = last.camp;
          mule.alignmentLevel = last.level;
          mule.alignmentOrder = null;
        } else {
          const base = mule.alignmentBefore as any;
          mule.alignment = base?.alignment ?? "neutre";
          mule.alignmentOrder = base?.alignmentOrder ?? null;
          mule.alignmentLevel = base?.alignmentLevel ?? 0;
          delete mule.alignmentBefore;
        }
      }
      alts[idx] = mule;
      await db.userProfile.update({ where: { id: profile.id }, data: { altPseudos: alts as any, userUpdatedAt: new Date() } });
    } else {
      const data: any = { userUpdatedAt: new Date() };
      if (isChecked) {
        if (!profile.alignmentBefore) {
          data.alignmentBefore = {
            alignment: profile.alignment ?? null,
            alignmentOrder: profile.alignmentOrder ?? null,
            alignmentLevel: profile.alignmentLevel ?? 0,
          };
        }
        data.alignment = camp;
        data.alignmentLevel = level;
        data.alignmentOrder = null;
      } else {
        const last = await findLastCheckedAlignmentQuest(
          profileId,
          characterSlot,
          sequence.milestone?.guide?.slug,
          sequenceId
        );
        if (last) {
          data.alignment = last.camp;
          data.alignmentLevel = last.level;
          data.alignmentOrder = null;
        } else {
          const base = profile.alignmentBefore as any;
          data.alignment = base?.alignment ?? "neutre";
          data.alignmentOrder = base?.alignmentOrder ?? null;
          data.alignmentLevel = base?.alignmentLevel ?? 0;
          data.alignmentBefore = null;
        }
      }
      await db.userProfile.update({ where: { id: profile.id }, data });
    }
  } catch (err) {
    logger.error("[applyRushAlignmentFromSequence] write failed", { error: err });
    return { success: false, error: "Erreur lors de la mise à jour d'alignement" };
  }

  const { invalidateUserContextCache } = await import("./user-actions");
  await invalidateUserContextCache(ctx.id!, profile.guildId, guildId).catch(() => {});
  revalidatePath(`/dashboard/${guildId}/profile`);
  revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  if (sequence.milestone?.guide?.slug) {
    revalidatePath(`/dashboard/${guildId}/quetes-dofus/guide/${sequence.milestone.guide.slug}`);
  }

  return { success: true, applied: isChecked, camp, level };
}

/**
 * ── S4 — « Démarrage du rush » : reset l'alignement du perso à 0/neutre,
 *    en mémorisant l'alignement manuel courant comme base (`alignmentBefore`).
 */
export async function resetRushAlignment(guildId: string, altPseudo?: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) throw new Error("Non autorisé");
  if (!ctx.profileId) throw new Error("Profile ID manquant");

  const { success: rateOk } = await rateLimit(`guide-alignment:${ctx.profileId}`, 10, 60_000);
  if (!rateOk) throw new Error("Trop de requêtes, veuillez patienter.");

  const { profileId, characterSlot } = resolvePlayerProgressKey(ctx.profileId, altPseudo);
  const isMule = characterSlot !== "PRINCIPAL";

  const profile = await db.userProfile.findUnique({
    where: { id: profileId },
    select: { id: true, guildId: true, alignment: true, alignmentOrder: true, alignmentLevel: true, alignmentBefore: true, altPseudos: true },
  });
  if (!profile) return { success: false, error: "Profil introuvable" };

  try {
    if (isMule) {
      const alts = Array.isArray(profile.altPseudos) ? [...(profile.altPseudos as any[])] : [];
      const idx = alts.findIndex((m: any) => m.pseudo === characterSlot);
      if (idx === -1) return { success: false, error: "Mule introuvable" };
      const mule = { ...alts[idx] };
      mule.alignmentBefore = mule.alignmentBefore ?? {
        alignment: mule.alignment ?? null,
        alignmentOrder: mule.alignmentOrder ?? null,
        alignmentLevel: mule.alignmentLevel ?? 0,
      };
      mule.alignment = "neutre";
      mule.alignmentOrder = null;
      mule.alignmentLevel = 0;
      alts[idx] = mule;
      await db.userProfile.update({ where: { id: profile.id }, data: { altPseudos: alts as any, userUpdatedAt: new Date() } });
    } else {
      const data: any = { userUpdatedAt: new Date() };
      data.alignmentBefore = profile.alignmentBefore ?? {
        alignment: profile.alignment ?? null,
        alignmentOrder: profile.alignmentOrder ?? null,
        alignmentLevel: profile.alignmentLevel ?? 0,
      };
      data.alignment = "neutre";
      data.alignmentOrder = null;
      data.alignmentLevel = 0;
      await db.userProfile.update({ where: { id: profile.id }, data });
    }
  } catch (err) {
    logger.error("[resetRushAlignment] write failed", { error: err });
    return { success: false, error: "Erreur lors de la réinitialisation" };
  }

  const { invalidateUserContextCache } = await import("./user-actions");
  await invalidateUserContextCache(ctx.id!, profile.guildId, guildId).catch(() => {});
  revalidatePath(`/dashboard/${guildId}/profile`);
  revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
  return { success: true };
}

// ===========================================================================
// S4 « qui peut aider » — badges membre (INFORMATIF : aucune invitation)
// ===========================================================================

const getSequenceHelpersSchema = z.object({
  guildId: z.string().min(1),
  sequenceId: z.string().min(1),
});

/**
 * ── S4 « qui peut aider » — retourne les membres capables d'aider une séquence ──
 * Résout en BULK les profils ACTIFS de la guilde (métiers + alignment) et leur
 * progression donjons (`UserDungeonProgress`), puis délègue à `findSequenceHelpers`
 * (helper pur, déjÀ testé). Garde guilde + Zod + rate-limit (fail-closed).
 */
export async function getSequenceHelpers(guildId: string, sequenceId: string) {
  const parsed = getSequenceHelpersSchema.safeParse({ guildId, sequenceId });
  if (!parsed.success) return { success: false, error: "Paramètres invalides" };

  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) return { success: false, error: "Non autorisé" };
  if (!ctx.profileId) return { success: false, error: "Profile ID manquant" };

  const { success: rateOk } = await rateLimit(`guide-helpers:${ctx.profileId}`, 30, 60_000);
  if (!rateOk) return { success: false, error: "Trop de requêtes, veuillez patienter." };

  const sequence = await db.guideSequence.findUnique({
    where: { id: sequenceId },
    select: {
      id: true,
      subGuideRef: true,
      subGuideName: true,
      dungeonId: true,
      dungeonIds: true,
      alignReq: true,
      alignOrderReq: true,
      activityTags: true,
      dungeon: { select: { id: true, name: true, bossName: true, imageUrl: true } },
    },
  });
  if (!sequence) return { success: false, error: "Séquence introuvable" };

  const [profiles, progress] = await Promise.all([
    db.userProfile.findMany({
      where: { guild: { discordGuildId: guildId }, status: "ACTIVE" },
      select: {
        id: true,
        pseudoDofus: true,
        discordNickname: true,
        classe: true,
        dofusLevel: true,
        alignment: true,
        alignmentOrder: true,
        alignmentLevel: true,
        metiers: true,
        user: { select: { name: true, image: true } },
      },
    }),
    db.userDungeonProgress.findMany({
      where: { profile: { guild: { discordGuildId: guildId }, status: "ACTIVE" } },
      select: { profileId: true, dungeonId: true },
    }),
  ]);

  const dungeonIdsByProfile = new Map<string, Set<string>>();
  for (const p of progress) {
    if (!dungeonIdsByProfile.has(p.profileId)) dungeonIdsByProfile.set(p.profileId, new Set());
    dungeonIdsByProfile.get(p.profileId)!.add(p.dungeonId);
  }

  const resolveMetiers = (metiers: unknown): RushHelperMetier[] =>
    normalizeMetiers(metiers).map((m) => ({ name: m.name, level: m.level }));

  const members: RushHelperProfile[] = profiles.map((p) => ({
    profileId: p.id,
    name: p.pseudoDofus || p.discordNickname || p.user?.name || "Membre",
    avatar: p.user?.image || undefined,
    classe: p.classe ?? null,
    dofusLevel: p.dofusLevel ?? null,
    alignment: p.alignment ?? null,
    alignmentOrder: p.alignmentOrder ?? null,
    alignmentLevel: p.alignmentLevel ?? null,
    metiers: resolveMetiers(p.metiers),
    completedDungeonIds: Array.from(dungeonIdsByProfile.get(p.id) || []),
  }));

  // Résolution des `dungeonIds` en objets { id, name } (le helper pur a besoin du nom).
  const dungeonIdList = (sequence.dungeonIds || []).filter((id): id is string => typeof id === "string");
  let dungeons: RushSequence["dungeons"] = [];
  if (dungeonIdList.length > 0) {
    const rows = await db.dungeon.findMany({
      where: { id: { in: dungeonIdList } },
      select: { id: true, name: true, bossName: true, imageUrl: true },
    });
    dungeons = rows;
  }

  const seqForHelpers: RushSequence = {
    id: sequence.id,
    subGuideRef: sequence.subGuideRef,
    subGuideName: sequence.subGuideName,
    isOptional: false,
    order: 0,
    dungeonId: sequence.dungeonId ?? null,
    dungeonIds: dungeonIdList,
    dungeon: sequence.dungeon ?? undefined,
    dungeons: dungeons.length > 0 ? dungeons : undefined,
    alignReq: sequence.alignReq ?? null,
    alignOrderReq: sequence.alignOrderReq ?? null,
    activityTags: Array.isArray(sequence.activityTags) ? (sequence.activityTags as any[]) : [],
  };

  const helpers = findSequenceHelpers(seqForHelpers, members);
  return { success: true, ...helpers };
}

// ===========================================================================
// GOD-SIDE ADMIN ACTIONS
// ===========================================================================

/**
 * Récupère le guide complet avec ses milestones et séquences pour l'admin.
 */
export async function getGuideAdminFull(guideId: string) {
  await requireGuideAccess();

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
  await requireGuideAccess();

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
  await requireGuideWriteAccess("upsert-milestone", 30);

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

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: id ?? guideId,
    metadata: { op: id ? "update-milestone" : "create-milestone", title: milestoneData.title, guideId },
  });

  revalidatePath("/god/dofus-guides");
  return { success: true, milestone };
}

/**
 * Supprime un milestone (et ses séquences en cascade).
 */
export async function deleteMilestone(milestoneId: string) {
  await requireGuideAccess();

  await db.guideMilestone.delete({ where: { id: milestoneId } });
  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: milestoneId,
    metadata: { op: "delete-milestone" },
  });
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
  await requireGuideAccess();

  const { id, milestoneId, ...seqData } = data;

  const sequence = id
    ? await db.guideSequence.update({ where: { id }, data: seqData })
    : await db.guideSequence.create({ data: { milestoneId, ...seqData } });

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: id ?? milestoneId,
    metadata: { op: id ? "update-sequence" : "create-sequence", subGuideRef: seqData.subGuideRef, milestoneId },
  });

  revalidatePath("/god/dofus-guides");
  return { success: true, sequence };
}

/**
 * Supprime une séquence.
 */
export async function deleteSequence(sequenceId: string) {
  await requireGuideAccess();

  await db.guideSequence.delete({ where: { id: sequenceId } });
  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: sequenceId,
    metadata: { op: "delete-sequence" },
  });
  revalidatePath("/god/dofus-guides");
  return { success: true };
}

/**
 * Supprime TOUS les milestones d'un guide (reset avant import).
 */
export async function deleteAllMilestones(guideId: string) {
  await requireGuideWriteAccess("delete-all-milestones", 5);

  await db.guideMilestone.deleteMany({ where: { guideId } });
  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: guideId,
    metadata: { op: "delete-all-milestones" },
  });
  revalidatePath("/god/dofus-guides");
  return { success: true };
}

/**
 * ── Réparation des refs Alignement Bonta/Brâkmar ────────────────────────────
 * Garantit que GP9 = BONTARIEN et GP9B = BRÂKMARIEN quel que soit l'ordre
 * d'import initial. Idempotent — safe à relancer plusieurs fois.
 * Corrige aussi toutes les GuideSequence qui pointent vers le mauvais ref.
 */
export async function repairAlignmentRefs() {
  await requireGuideWriteAccess("repair-alignment", 5);

  // 1. Trouver tous les variants GP9x
  const gp9Variants = await db.subGuideData.findMany({
    where: { guideRef: { startsWith: "GP9" } },
    select: { id: true, guideRef: true, guideName: true, ganymadeId: true },
  });

  const bontarien = gp9Variants.find(g =>
    g.guideName.toUpperCase().includes("BONTARIEN")
  );
  const brakmarien = gp9Variants.find(g =>
    g.guideName.toUpperCase().includes("BRAKMARIEN") ||
    g.guideName.toUpperCase().includes("BRÂKMARIEN")
  );

  if (!bontarien || !brakmarien) {
    return {
      success: false,
      error: "Les deux guides d'alignement ne sont pas encore importés. Importez Bontarien ET Brâkmarien depuis l'onglet Import Ganymède avant de lancer la réparation.",
      bontarienFound: !!bontarien,
      brakmarienFound: !!brakmarien,
    };
  }

  let fixedSubGuides = 0;

  // 2. Corriger SubGuideData si nécessaire (swap ou rename simple)
  if (bontarien.guideRef !== "GP9" || brakmarien.guideRef !== "GP9B") {
    const tempRef = "__GP9_REPAIR_TEMP__";
    // Phase 1 : libérer GP9 si occupé par Brâkmarien
    if (brakmarien.guideRef === "GP9") {
      await db.subGuideData.update({ where: { id: brakmarien.id }, data: { guideRef: tempRef } });
    }
    // Phase 2 : affecter GP9 à Bontarien
    if (bontarien.guideRef !== "GP9") {
      await db.subGuideData.update({ where: { id: bontarien.id }, data: { guideRef: "GP9" } });
      fixedSubGuides++;
    }
    // Phase 3 : affecter GP9B à Brâkmarien (depuis tempRef ou autre ref)
    if (brakmarien.guideRef !== "GP9B") {
      await db.subGuideData.update({ where: { id: brakmarien.id }, data: { guideRef: "GP9B" } });
      fixedSubGuides++;
    }
  }

  // 3. Corriger les séquences (basé sur le nom, pas le ref stocké)
  const [seqBontResult, seqBrakResult, seqBrakAltResult] = await Promise.all([
    db.guideSequence.updateMany({
      where: {
        subGuideName: { contains: "BONTARIEN", mode: "insensitive" },
        NOT: { subGuideRef: "GP9" },
      },
      data: { subGuideRef: "GP9" },
    }),
    db.guideSequence.updateMany({
      where: {
        subGuideName: { contains: "BRÂKMARIEN", mode: "insensitive" },
        NOT: { subGuideRef: "GP9B" },
      },
      data: { subGuideRef: "GP9B" },
    }),
    // Variante sans accent
    db.guideSequence.updateMany({
      where: {
        subGuideName: { contains: "BRAKMARIEN", mode: "insensitive" },
        NOT: { subGuideRef: "GP9B" },
      },
      data: { subGuideRef: "GP9B" },
    }),
  ]);

  const fixedSequences =
    seqBontResult.count + seqBrakResult.count + seqBrakAltResult.count;

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: "GP9/GP9B",
    metadata: { op: "repair-alignment-refs", fixedSubGuides, fixedSequences },
  });

  revalidatePath("/god/dofus-guides");

  return {
    success: true,
    fixedSubGuides,
    fixedSequences,
    bontarienRef: "GP9",
    brakmarienRef: "GP9B",
  };
}

/**
 * Importe et stocke un sous-guide Ganymède (GP1, GP2...) en base.
 * Le JSON contient { id, name, steps: [{ id, web_text, pos_x, pos_y }] }
 */
export async function importSubGuide(jsonData: any) {
  await requireGuideWriteAccess("import-sub-guide", 10);

  const { parseSubGuideSteps } = await import("@/lib/ganymede-parser");

  const ganymadeId: number = jsonData.id;
  const guideName: string = jsonData.name ?? `Guide #${ganymadeId}`;
  const rawSteps: any[] = jsonData.steps ?? [];

  const refMatch = guideName.match(/\[(GP\d+)\]/i);
  let guideRef = refMatch ? refMatch[1].toUpperCase() : `GP${ganymadeId}`;

  // ── Détection de conflit de guideRef ─────────────────────────────────────
  // Deux guides Ganymède peuvent partager le même préfixe [GPx] (ex: GP9 Bontarien
  // et GP9 Brâkmarien). Si le guideRef existe déjà avec un ganymadeId différent,
  // on génère un variant : GP9 → GP9B → GP9C … pour les stocker séparément.
  if (refMatch) {
    const existing = await db.subGuideData.findUnique({
      where: { guideRef },
      select: { ganymadeId: true },
    });
    if (existing && existing.ganymadeId !== ganymadeId) {
      const SUFFIXES = "BCDEFGHIJKLMNOPQRSTUVWXYZ";
      let resolved = false;
      for (const letter of SUFFIXES) {
        const candidate = guideRef + letter;
        const candidateExisting = await db.subGuideData.findUnique({
          where: { guideRef: candidate },
          select: { ganymadeId: true },
        });
        // Slot libre OU déjà occupé par le même guide (re-import) → on prend ce slot
        if (!candidateExisting || candidateExisting.ganymadeId === ganymadeId) {
          guideRef = candidate;
          resolved = true;
          break;
        }
      }
      if (!resolved) {
        // Fallback ultime : utilise l'ID Ganymède brut (jamais en conflit)
        guideRef = `GP_ID${ganymadeId}`;
      }
    }
  }

  // Parse enrichi : chaque step contient maintenant pos_x/y, map, dungeons, guideRefs, plainText
  const enrichedSteps = parseSubGuideSteps(rawSteps);

  const subGuide = await db.subGuideData.upsert({
    where: { guideRef },
    update: { ganymadeId, guideName, totalSteps: rawSteps.length, steps: enrichedSteps },
    create: { ganymadeId, guideName, guideRef, totalSteps: rawSteps.length, steps: enrichedSteps },
  });

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: guideRef,
    metadata: { op: "import-sub-guide", guideName, totalSteps: rawSteps.length },
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
  await requireGuideAccess();

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
  await requireGuideAccess();

  // Supprimer le sous-guide de la bibliothèque
  await db.subGuideData.delete({ where: { guideRef } });

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: guideRef,
    metadata: { op: "delete-sub-guide" },
  });

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
  await requireGuideAccess();

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

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: guideRef,
    metadata: { op: "update-sub-guide-step", stepNumber },
  });

  return { success: true };
}

/**
 * Met à jour les positions X/Y des nœuds après un drag-and-drop.
 */
export async function updateMilestonePositions(
  positions: { id: string; posX: number; posY: number }[]
) {
  await requireGuideWriteAccess("milestone-positions", 20);

  await Promise.all(
    positions.map((p) =>
      db.guideMilestone.update({
        where: { id: p.id },
        data: { posX: p.posX, posY: p.posY }
      })
    )
  );

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: positions.map((p) => p.id).join(","),
    metadata: { op: "update-milestone-positions", count: positions.length },
  });

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
  await requireGuideWriteAccess("import-guide", 10);

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

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: guideId,
    metadata: { op: "import-ganymede-guide", created, updated, deleted: toDelete.length },
  });

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
    logger.error("Failed to load map data on server side:", e);
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
    logger.error("Failed to resolve map world:", err);
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
  await requireGuideAccess();

  const guide = await db.optimizedGuide.update({
    where: { id: guideId },
    data,
  });

  await logGodWrite({
    action: "GOD_GUIDE_UPDATE",
    targetType: "DATA_SYNC",
    targetId: guideId,
    metadata: { op: "update-guide-settings", data },
  });

  revalidatePath("/god/dofus-guides");
  return { success: true, guide };
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
  await requireRushAccess();

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

  // Resolve all dungeons from dungeonIds for each sequence
  if (guide) {
    const allDungeonIds = new Set<string>();
    for (const ms of guide.milestones) {
      for (const seq of ms.sequences) {
        if (Array.isArray((seq as any).dungeonIds)) {
          for (const did of (seq as any).dungeonIds) {
            if (did) allDungeonIds.add(did);
          }
        }
      }
    }
    if (allDungeonIds.size > 0) {
      const dungeons = await db.dungeon.findMany({
        where: { id: { in: Array.from(allDungeonIds) } },
        select: { id: true, name: true, bossName: true, imageUrl: true }
      });
      const dungeonMap = new Map(dungeons.map(d => [d.id, d]));
      for (const ms of guide.milestones) {
        for (const seq of ms.sequences) {
          const ids = (seq as any).dungeonIds as string[] | undefined;
          if (ids && ids.length > 0) {
            (seq as any).dungeons = ids.map(id => dungeonMap.get(id)).filter(Boolean);
          }
        }
      }
    }
  }

  return guide;
}

/**
 * (God) Seed le guide Rush Sylvestre depuis le dataset Laniyelle curé.
 * - DRY-RUN par défaut (`apply:false`) : renvoie un aperçu sans rien écrire.
 * - Idempotent & NON destructif : ne crée que les milestones/séquences absents
 *   (clé = titre du milestone / nom de séquence). Aucun écrasement des retouches GOD.
 */
// ─────────────────────────────────────────────────────────────────────────────
// Enrichissement NON destructif — réutilisé par le bouton « Importer » (seed).
// Logique identique à scripts/seed-rush-sylvestre-enriched-cli.mjs : lit
// `rush-sylvestre-guide.enriched.json`, retrouve chaque GuideSequence par
// subGuideRef normalisé et remplit UNIQUEMENT les champs vides (jamais d'écrasement).
// ─────────────────────────────────────────────────────────────────────────────
function enrNorm(s = "") {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, " ").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}
function enrNormK(s = "") {
  return enrNorm((s || "").replace(/œ/gi, "oe").replace(/æ/gi, "ae"));
}
const enrClean = (s = "") => (s || "").replace(/[.!?\u00a0]+$/g, "");
function enrTagKey(t: any = {}) {
  return `${t.type || ""}|${t.name || ""}|${t.level ?? ""}|${t.count ?? ""}`;
}
function enrMergeTags(existing: any[], incoming: any[]) {
  const out = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(out.map(enrTagKey));
  for (const t of incoming) { const k = enrTagKey(t); if (!seen.has(k)) { out.push(t); seen.add(k); } }
  return out;
}
function enrBuildUpdate(seq: any, q: any) {
  const data: any = {};
  if (q.dofusdbUrl && !seq.dofusdbUrl) data.dofusdbUrl = q.dofusdbUrl;
  if (q.dofuspourlesnoobsUrl && !seq.dofuspourlesnoobsUrl) data.dofuspourlesnoobsUrl = q.dofuspourlesnoobsUrl;
  if (q.questDbIds && Array.isArray(q.questDbIds) && q.questDbIds.length && (!Array.isArray(seq.questDbIds) || !seq.questDbIds.length)) data.questDbIds = q.questDbIds;
  if (q.mapPositions && Array.isArray(q.mapPositions) && q.mapPositions.length && (!Array.isArray(seq.mapPositions) || !seq.mapPositions.length)) data.mapPositions = q.mapPositions;
  if (q.alignReq != null && seq.alignReq == null) data.alignReq = String(q.alignReq);
  if (q.alignOrderReq != null && seq.alignOrderReq == null) data.alignOrderReq = q.alignOrderReq;
  if (q.dungeonIds && Array.isArray(q.dungeonIds) && q.dungeonIds.length && (!Array.isArray(seq.dungeonIds) || !seq.dungeonIds.length)) data.dungeonIds = q.dungeonIds;
  // Positions GPS : mapPositions (structuré x,y) -> tag « pos_tags » (lu par GOD/Dashboard/Overlay).
  // L'UI ne consomme que activityTags[pos_tags], jamais mapPositions directement.
  const incomingTags = Array.isArray(q.activityTags) ? [...q.activityTags] : [];
  const hasPosTag = Array.isArray(seq.activityTags) && seq.activityTags.some((t: any) => t.type === "pos_tags");
  if (!hasPosTag && Array.isArray(q.mapPositions) && q.mapPositions.length) {
    incomingTags.push({ type: "pos_tags", name: q.mapPositions.map((p: any) => `${p.x}, ${p.y}`).join(" ; "), worldId: 1 });
  }
  if (incomingTags.length) {
    const merged = enrMergeTags(seq.activityTags || [], incomingTags);
    if (merged.length !== (Array.isArray(seq.activityTags) ? seq.activityTags.length : 0)) data.activityTags = merged;
  }
  return data;
}

async function enrichRushSylvestreSequences(opts: { apply?: boolean } = {}) {
  const apply = !!opts.apply;
  let enriched: { quests?: any[] };
  try {
    enriched = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/data/rush-sylvestre-guide.enriched.json"), "utf8"));
  } catch {
    return { dryRun: !apply, matched: 0, unmatched: 0, updates: 0, error: "fichier enrichi introuvable" };
  }
  const quests = Array.isArray(enriched.quests) ? enriched.quests : [];
  if (!quests.length) return { dryRun: !apply, matched: 0, unmatched: 0, updates: 0 };

  const guide = await db.optimizedGuide.findUnique({
    where: { slug: "rush-sylvestre" },
    include: { milestones: { include: { sequences: true } } },
  });
  if (!guide) return { dryRun: !apply, matched: 0, unmatched: 0, updates: 0 };

  const byRef = new Map<string, any[]>();
  let totalSeqs = 0;
  for (const ms of guide.milestones) {
    for (const s of ms.sequences) {
      totalSeqs++;
      const k = enrNormK(enrClean(s.subGuideRef));
      if (!byRef.has(k)) byRef.set(k, []);
      byRef.get(k)!.push(s);
    }
  }

  let matched = 0, unmatched = 0, updates = 0;
  const toWrite: { id: string; data: any }[] = [];
  const fieldsCount: Record<string, number> = {};
  for (const q of quests) {
    const matches = byRef.get(enrNormK(enrClean(q.name))) || [];
    if (!matches.length) { unmatched++; continue; }
    matched++;
    for (const seq of matches) {
      const data = enrBuildUpdate(seq, q);
      const keys = Object.keys(data);
      if (keys.length) {
        toWrite.push({ id: seq.id, data });
        updates++;
        for (const f of keys) fieldsCount[f] = (fieldsCount[f] || 0) + 1;
      }
    }
  }

  if (apply) {
    for (const w of toWrite) await db.guideSequence.update({ where: { id: w.id }, data: w.data });
  }
  return { dryRun: !apply, matched, unmatched, updates, totalSeqs, fieldsCount };
}


export async function seedRushSylvestreFromGuide(opts: { apply?: boolean } = {}) {
  await requireRushAccess();
  const apply = !!opts.apply;

  const raw = fs.readFileSync(path.join(process.cwd(), "src/data/rush-sylvestre-guide.json"), "utf8");
  const data = JSON.parse(raw) as {
    preparation: { metiers: { name: string; level: number }[]; items: { name: string; ankamaId: number | null; imageUrl: string | null; quantity: number }[] };
    milestones: { title: string; notes: string | null; succès: string; aide: string; dungeons: { name: string; id: string | null; imageUrl: string | null; totem: boolean; note?: string }[]; sequences: { name: string; dungeonIds: string[]; succès: string }[] }[];
  };

  // ── Détection du type de milestone ──
  const detectType = (title: string): string => {
    const t = (title || "").toLowerCase();
    if (t.includes("alignement") || t.includes("ordre")) return "ALIGNEMENT";
    if (t.includes("prérequis") || t.includes("pré-recquis") || t.includes("prerequis")) return "PREREQUIS";
    if (t.includes("récupérer") || t.includes("recuperer") || t.includes("zone")) return "ZONE";
    if (t.includes("dofus")) return "DOFUS";
    return "QUETE_SERIE";
  };

  const guide = await getOrCreateRushSylvestreGuide();
  const existingMs = await db.guideMilestone.findMany({
    where: { guideId: guide.id },
    select: { id: true, title: true },
  });
  const existingTitles = new Set(existingMs.map((m) => m.title.trim().toLowerCase()));
  const plan = { milestones: 0, sequences: 0, items: 0, metiers: 0, dungeons: 0 };

  const toCreate: { title: string; type: string; chapter: number; chapterLabel: string; order: number; tips: string | null; dungeons: { name: string; id: string | null; imageUrl: string | null }[]; sequences: { name: string; dungeonIds: string[]; note: string | null }[] }[] = [];

  // ── Milestone « Préparation » (métiers + ressources) ──
  const prepMilestone = existingMs.find((m) => m.title.trim().toLowerCase() === "préparation");
  if (!prepMilestone) {
    toCreate.push({
      title: "Préparation",
      type: "PREREQUIS",
      chapter: 0,
      chapterLabel: "Préparation",
      order: -1,
      tips: "Métiers & ressources à préparer avant de lancer le rush.",
      dungeons: [],
      sequences: [
        { name: "Métiers requis", dungeonIds: [], note: null },
        { name: "Ressources à prévoir", dungeonIds: [], note: null },
      ],
    });
    plan.metiers = data.preparation.metiers.length;
    plan.items = data.preparation.items.length;
  }

  // ── Milestones du guide ──
  data.milestones.forEach((ms, i) => {
    const key = ms.title.trim().toLowerCase();
    if (existingTitles.has(key)) return;
    plan.milestones++;
    plan.dungeons += ms.dungeons.length;
    plan.sequences += ms.sequences.length;
    toCreate.push({
      title: ms.title,
      type: detectType(ms.title),
      chapter: i + 1,
      chapterLabel: ms.title.slice(0, 42),
      order: i,
      tips: [ms.notes, ms.succès ? `Succès : ${ms.succès}` : "", ms.aide ? `Aide : ${ms.aide}` : ""].filter(Boolean).join(" · ") || null,
      dungeons: ms.dungeons.filter((d) => d.id),
      sequences: ms.sequences.map((s) => ({ name: s.name, dungeonIds: s.dungeonIds, note: ms.aide || null })),
    });
  });

  if (!apply) {
    const enrichment = await enrichRushSylvestreSequences({ apply: false });
    return { success: true, dryRun: true, plan, guideId: guide.id, totalToCreate: toCreate.length, enrichment };
  }

  // ── Écriture (transaction) ──
  const created = { milestones: 0, sequences: 0 };
  await db.$transaction(async (tx) => {
    for (const ms of toCreate) {
      const milestone = await tx.guideMilestone.create({
        data: {
          guideId: guide.id,
          type: ms.type as any,
          chapter: ms.chapter,
          chapterLabel: ms.chapterLabel,
          title: ms.title,
          tips: ms.tips,
          order: ms.order,
        },
      });
      created.milestones++;
      for (let sIdx = 0; sIdx < ms.sequences.length; sIdx++) {
        const s = ms.sequences[sIdx];
        // séquence « Métiers requis » / « Ressources à prévoir » → tags dédiés
        let activityTags: any[] = [];
        if (ms.title === "Préparation" && s.name === "Métiers requis") {
          activityTags = data.preparation.metiers.map((m) => ({ type: "metier", name: m.name, level: m.level }));
        } else if (ms.title === "Préparation" && s.name === "Ressources à prévoir") {
          activityTags = data.preparation.items.map((it) => ({ type: "item", name: it.name, count: it.quantity, imageUrl: it.imageUrl, id: it.ankamaId ? String(it.ankamaId) : undefined }));
        } else {
          activityTags = ms.dungeons.map((d) => ({ type: "donjon", name: d.name, id: d.id }));
        }
        await tx.guideSequence.create({
          data: {
            milestoneId: milestone.id,
            order: sIdx,
            subGuideRef: s.name,
            subGuideName: s.name,
            dungeonIds: ms.dungeons.map((d) => d.id).filter(Boolean) as string[],
            tips: ms.title === "Préparation" ? undefined : (ms.tips ?? undefined),
            note: s.note,
            activityTags,
          },
        });
        created.sequences++;
      }
    }

    // ── Idempotence « Préparation » existante ──
    // Si le milestone « Préparation » existait déjà (base antérieure) mais sans
    // la séquence « Ressources à prévoir » (ou « Métiers requis »), on l'ajoute
    // avec les objets/métiers du dataset curé. Non destructif (insert seul).
    if (prepMilestone) {
      const existing = await tx.guideSequence.findMany({
        where: { milestoneId: prepMilestone.id },
        select: { subGuideName: true, subGuideRef: true, order: true },
      });
      const names = new Set(existing.map((s) => s.subGuideName || s.subGuideRef));
      let nextOrder = existing.length ? Math.max(...existing.map((s) => s.order ?? 0)) + 1 : 1;
      if (!names.has("Métiers requis")) {
        plan.metiers = data.preparation.metiers.length;
        await tx.guideSequence.create({
          data: {
            milestoneId: prepMilestone.id,
            order: nextOrder++,
            subGuideRef: "Métiers requis",
            subGuideName: "Métiers requis",
            dungeonIds: [],
            activityTags: data.preparation.metiers.map((m) => ({ type: "metier", name: m.name, level: m.level })),
          },
        });
        created.sequences++;
      }
      if (!names.has("Ressources à prévoir")) {
        plan.items = data.preparation.items.length;
        await tx.guideSequence.create({
          data: {
            milestoneId: prepMilestone.id,
            order: nextOrder++,
            subGuideRef: "Ressources à prévoir",
            subGuideName: "Ressources à prévoir",
            dungeonIds: [],
            activityTags: data.preparation.items.map((it) => ({ type: "item", name: it.name, count: it.quantity, imageUrl: it.imageUrl, id: it.ankamaId ? String(it.ankamaId) : undefined })),
          },
        });
        created.sequences++;
      }
    }
  });

  const enrichment = await enrichRushSylvestreSequences({ apply: true });
  await logGodWrite({
    action: "GOD_DATABASE_SYNC",
    targetType: "DATA_SYNC",
    targetId: "rush-sylvestre",
    metadata: { op: "seed-laniyelle", dryRun: false, plan, created, enrichment },
  });
  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true, dryRun: false, plan, created, guideId: guide.id, enrichment };
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
  await requireRushAccess();

  const guide = await db.optimizedGuide.update({
    where: { slug: "rush-sylvestre" },
    data,
  });

  await logGodWrite({
    action: "GOD_RUSH_UPDATE",
    targetType: "DATA_SYNC",
    targetId: "rush-sylvestre",
    metadata: { op: "update-rush-settings", data },
  });

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true, guide };
}

/**
 * (God) Met à jour la config UI/UX du Rush (pense-bête + options modale de lancement).
 * Champ `OptimizedGuide.rushUIConfig` (JsonB). Si vide, les membres retombent sur les défauts.
 */
export async function updateRushUIConfig(data: { rushUIConfig: unknown }) {
  await requireRushAccess();

  const guide = await db.optimizedGuide.update({
    where: { slug: "rush-sylvestre" },
    data: { rushUIConfig: data.rushUIConfig as any },
  });

  await logGodWrite({
    action: "GOD_RUSH_UI_UPDATE",
    targetType: "DATA_SYNC",
    targetId: "rush-sylvestre",
    metadata: { op: "update-rush-ui-config", data: data.rushUIConfig },
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
  /** Image du bloc — disponible pour TOUS les types (immersion : elle se loge à
   *  droite du bloc côté membre, servie nue, sans cadre). */
  imageUrl?: string | null;
  accentColor?: string;
  isOptional?: boolean;
  order?: number;
  type?: any; // GuideMilestoneType enum
  tips?: string;
  dofusId?: string | null;
}) {
  await requireRushAccess();

  const guide = await db.optimizedGuide.findUniqueOrThrow({ where: { slug: "rush-sylvestre" } });

  const isSeparator = data.type === "SEPARATEUR";

  let parsedChapter = parseInt(data.chapter, 10);
  if (isNaN(parsedChapter)) {
    parsedChapter = isSeparator ? 0 : 1;
  }
  if (isSeparator) {
    parsedChapter = 0;
  }

  const chapterLabel = isSeparator ? "" : data.chapterLabel;
  const dofusId = isSeparator ? null : data.dofusId;
  const accentColor = data.accentColor ?? (isSeparator ? "#d4a853" : "#10b981");

  let milestone;
  if (data.id) {
    milestone = await db.guideMilestone.update({
      where: { id: data.id },
      data: {
        chapter: parsedChapter,
        chapterLabel,
        title: data.label,
        description: data.description,
        imageUrl: data.imageUrl ?? null,
        accentColor,
        isOptional: data.isOptional ?? false,
        order: data.order ?? 0,
        type: data.type ?? undefined,
        tips: data.tips,
        dofusId,
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
        chapterLabel,
        title: data.label,
        description: data.description,
        imageUrl: data.imageUrl ?? null,
        accentColor,
        isOptional: data.isOptional ?? false,
        order: data.order ?? maxOrder,
        tips: data.tips,
        dofusId,
      },
      include: {
        sequences: {
          orderBy: { order: "asc" },
          include: { dungeon: true }
        }
      },
    });
  }

  await logGodWrite({
    action: "GOD_RUSH_UPDATE",
    targetType: "DATA_SYNC",
    targetId: data.id ?? `rush-chapter-${data.chapter}`,
    metadata: { op: data.id ? "update-rush-milestone" : "create-rush-milestone", label: data.label },
  });

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true, milestone };
}

/**
 * (God) Supprime un milestone du Rush Sylvestre.
 */
export async function deleteRushMilestone(milestoneId: string) {
  await requireRushAccess();

  await db.guideMilestone.delete({ where: { id: milestoneId } });
  await logGodWrite({
    action: "GOD_RUSH_UPDATE",
    targetType: "DATA_SYNC",
    targetId: milestoneId,
    metadata: { op: "delete-rush-milestone" },
  });
  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * (God) Reordonne une liste de milestones (Drag & Drop)
 */
export async function reorderRushMilestones(orderedIds: string[]) {
  await requireRushAccess();

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.guideMilestone.update({
        where: { id },
        data: { order: index }
      })
    )
  );

  await logGodWrite({
    action: "GOD_RUSH_UPDATE",
    targetType: "DATA_SYNC",
    targetId: orderedIds.join(","),
    metadata: { op: "reorder-rush-milestones", count: orderedIds.length },
  });

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * (God) Reordonne les séquences d'un milestone (Drag & Drop)
 */
export async function reorderRushSequences(milestoneId: string, orderedIds: string[]) {
  await requireRushAccess();

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.guideSequence.update({
        where: { id },
        data: { order: index, milestoneId }
      })
    )
  );

  await logGodWrite({
    action: "GOD_RUSH_UPDATE",
    targetType: "DATA_SYNC",
    targetId: milestoneId,
    metadata: { op: "reorder-rush-sequences", count: orderedIds.length },
  });

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
  icon?: string | null;
  metamobMonsterId?: number | null;
  activityTags?: Array<{ type: string; name?: string; level?: number }>;
}) {
  await requireRushAccess();

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
    icon: data.icon ?? null,
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
        dungeonIds: data.dungeonIds ?? [],
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

  await logGodWrite({
    action: "GOD_RUSH_UPDATE",
    targetType: "DATA_SYNC",
    targetId: data.id ?? data.milestoneId,
    metadata: { op: data.id ? "update-rush-sequence" : "create-rush-sequence", subGuideRef: data.subGuideRef },
  });

  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true, sequence: seq };
}

/**
 * (God) Supprime une séquence Rush.
 */
export async function deleteRushSequence(sequenceId: string) {
  await requireRushAccess();

  await db.guideSequence.delete({ where: { id: sequenceId } });
  await logGodWrite({
    action: "GOD_RUSH_UPDATE",
    targetType: "DATA_SYNC",
    targetId: sequenceId,
    metadata: { op: "delete-rush-sequence" },
  });
  revalidatePath("/god/rush-sylvestre");
  revalidatePath("/dashboard");
  return { success: true };
}
