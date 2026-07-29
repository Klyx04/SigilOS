"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";

/**
 * Join or update rush presence for the current user
 */
export async function joinRushSession(
  guildId: string,
  pseudoDofus: string,
  dofusClass?: string | null
) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated || !ctx.profileId) {
    return { success: false, error: "Non autorisé" };
  }

  try {
    await db.rushPresence.upsert({
      where: {
        guildId_profileId: {
          guildId,
          profileId: ctx.profileId,
        },
      },
      update: {
        pseudoDofus,
        dofusClass: dofusClass || null,
        status: "ACTIVE",
        lastActivity: new Date(),
        lastHeartbeat: new Date(),
      },
      create: {
        guildId,
        profileId: ctx.profileId,
        pseudoDofus,
        dofusClass: dofusClass || null,
        status: "ACTIVE",
      },
    });

    return { success: true };
  } catch (e: any) {
    console.error("[Rush] joinRushSession error:", e?.message);
    return { success: false, error: "Erreur base de données" };
  }
}

/**
 * Leave the rush session (set status STOPPED or delete)
 */
export async function leaveRushSession(guildId: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated || !ctx.profileId) {
    return { success: false, error: "Non autorisé" };
  }

  try {
    await db.rushPresence.deleteMany({
      where: {
        guildId,
        profileId: ctx.profileId,
      },
    });

    return { success: true };
  } catch (e: any) {
    console.error("[Rush] leaveRushSession error:", e?.message);
    return { success: false, error: "Erreur base de données" };
  }
}

/**
 * Update the user's location (milestone / position in the guide)
 */
export async function updateRushLocation(
  guildId: string,
  milestoneId?: string | null,
  locationDesc?: string | null
) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated || !ctx.profileId) {
    return { success: false, error: "Non autorisé" };
  }

  try {
    await db.rushPresence.updateMany({
      where: {
        guildId,
        profileId: ctx.profileId,
        status: { not: "STOPPED" },
      },
      data: {
        milestoneId: milestoneId || null,
        locationDesc: locationDesc || null,
        lastActivity: new Date(),
        status: "ACTIVE",
      },
    });

    return { success: true };
  } catch (e: any) {
    console.error("[Rush] updateRushLocation error:", e?.message);
    return { success: false, error: "Erreur base de données" };
  }
}

/**
 * Heartbeat — keep session alive
 */
export async function heartbeatRush(guildId: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated || !ctx.profileId) {
    return { success: false };
  }

  try {
    await db.rushPresence.updateMany({
      where: {
        guildId,
        profileId: ctx.profileId,
        status: { not: "STOPPED" },
      },
      data: {
        lastHeartbeat: new Date(),
      },
    });

    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * Get all active rush members for a guild
 */
export async function getRushActiveMembers(guildId: string) {
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) {
    return { success: false, error: "Non autorisé", members: [] };
  }

  try {
    // First, mark AFK members who haven't sent heartbeat in 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    await db.rushPresence.updateMany({
      where: {
        guildId,
        status: "ACTIVE",
        lastHeartbeat: { lt: threeMinutesAgo },
      },
      data: { status: "AFK" },
    });

    // Also remove members with heartbeat > 5 minutes (disconnected)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db.rushPresence.deleteMany({
      where: {
        guildId,
        lastHeartbeat: { lt: fiveMinutesAgo },
      },
    });

    // Fetch active + AFK members
    const members = await db.rushPresence.findMany({
      where: {
        guildId,
        status: { in: ["ACTIVE", "AFK"] },
      },
      orderBy: { pseudoDofus: "asc" },
    });

    return { success: true, members };
  } catch (e: any) {
    console.error("[Rush] getRushActiveMembers error:", e?.message);
    return { success: false, error: "Erreur", members: [] };
  }
}