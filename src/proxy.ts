import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth(async (req) => {
    const { nextUrl } = req;

    // ─── PERFORMANCE GAIN: Short-circuit for images and common assets ───
    if (nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf)$/) || nextUrl.pathname.startsWith("/images/") || nextUrl.pathname.startsWith("/icons/")) {
        return NextResponse.next();
    }

    const isAuthenticated = !!req.auth;

    const isPublicApi = 
        nextUrl.pathname.startsWith("/api/auth") || 
        nextUrl.pathname.startsWith("/api/health") ||
        nextUrl.pathname.startsWith("/api/god/notify") || 
        nextUrl.pathname.startsWith("/api/cron/guildaton-report") || 
        nextUrl.pathname.startsWith("/api/discord/interactions") || 
        nextUrl.pathname.startsWith("/api/storage") || 
        nextUrl.pathname.startsWith("/api/og"); 

    if (nextUrl.pathname.startsWith("/uploads/")) {
        const protectedPath = nextUrl.pathname.replace("/uploads/", "/api/storage/");
        return NextResponse.rewrite(new URL(protectedPath, req.url));
    }

    if (nextUrl.pathname.startsWith("/api")) {
        if (!isPublicApi && !isAuthenticated) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    return NextResponse.next();
})

export const config = {
    matcher: ["/((?!api/auth|api/health|api/god/notify|_next/static|_next/image|favicon.ico|images|fonts|icons|uploads|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf)$).*)"],
}
