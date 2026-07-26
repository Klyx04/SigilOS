"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";

/**
 * Get the set of metamob boss monster IDs that the current user has already captured
 * (status=2 means "owned" in Metamob terms).
 * Falls back to snapshot in DB, returns empty set if no data.
 */
export async function getCapturedOcreMonsterIds(guildId: string): Promise<Set<number>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return new Set();

    const profile = await db.userProfile.findFirst({
      where: {
        userId: session.user.id,
        guild: { discordGuildId: guildId },
        status: "ACTIVE",
      },
      select: {
        ocreProgressSnapshot: true,
      },
    });

    if (!profile?.ocreProgressSnapshot) return new Set();

    const snapshot = profile.ocreProgressSnapshot as any;
    const monsters = snapshot.monsters as any[];

    if (!Array.isArray(monsters)) return new Set();

    return new Set(
      monsters
        .filter((m: any) => m.owned != null && m.owned > 0)
        .map((m: any) => m.id)
    );
  } catch {
    return new Set();
  }
}