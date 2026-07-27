import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * POST /api/rush/leave
 * Used by navigator.sendBeacon on tab close to remove the user from rush presence.
 * sendBeacon sends a POST request by default.
 */
export async function POST(request: NextRequest) {
  try {
    const guildId = request.nextUrl.searchParams.get("guildId");
    if (!guildId) {
      return NextResponse.json({ success: false, error: "Missing guildId" }, { status: 400 });
    }

    // Try to get the session from the cookie
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user?.id) {
      // User not logged in — nothing to clean up
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    // Find all profiles for this user in this guild and clean their rush presence
    const profiles = await db.userProfile.findMany({
      where: {
        userId: session.user.id,
        guildId,
      },
      select: { id: true },
    });

    const profileIds = profiles.map(p => p.id);
    if (profileIds.length > 0) {
      await db.rushPresence.deleteMany({
        where: {
          guildId,
          profileId: { in: profileIds },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[API] rush/leave error:", e?.message);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}