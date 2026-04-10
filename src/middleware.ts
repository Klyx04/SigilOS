import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth(async (req) => {
    const { nextUrl } = req;
    const isAuthenticated = !!req.auth;

    // 1. Define Public API Whitelist
    const isPublicApi = 
        nextUrl.pathname.startsWith("/api/auth") || 
        nextUrl.pathname.startsWith("/api/health") ||
        nextUrl.pathname.startsWith("/api/god/notify") || 
        nextUrl.pathname.startsWith("/api/cron/guildaton-report") || // Handled via CRON_SECRET
        nextUrl.pathname.startsWith("/api/discord/interactions") || // Discord webhooks use signatures
        nextUrl.pathname.startsWith("/api/storage") || // Fine-grained RBAC handled in route
        nextUrl.pathname.startsWith("/api/og"); // Social previews

    // 1.5. Seamless Storage Protection
    // Rewrite all legacy /uploads/ paths to the new protected /api/storage route
    if (nextUrl.pathname.startsWith("/uploads/")) {
        const protectedPath = nextUrl.pathname.replace("/uploads/", "/api/storage/");
        return NextResponse.rewrite(new URL(protectedPath, req.url));
    }

    // 2. Protect Private API Routes
    if (nextUrl.pathname.startsWith("/api")) {
        if (!isPublicApi && !isAuthenticated) {
            return NextResponse.json(
                { error: "Unauthorized: API access requires session" }, 
                { status: 401 }
            );
        }
        return NextResponse.next();
    }

    // 3. Handle dashboard/protected page redirects (Optional, usually handled by NextAuth provider)
    // But keeping it flexible for custom logic if needed later.

    return NextResponse.next();
})

export const config = {
    // We remove the (?!api) exclusion to allow middleware to process API routes
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
