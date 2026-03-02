import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

// SEC-04: Verify HMAC-signed beta_access cookie (Edge-compatible)
async function verifyBetaCookie(cookieValue: string | undefined): Promise<boolean> {
    if (!cookieValue) return false
    const secret = process.env.AUTH_SECRET || "fallback-secret-do-not-use-in-prod"
    const lastDot = cookieValue.lastIndexOf(".")
    if (lastDot === -1) return false
    const value = cookieValue.substring(0, lastDot)
    const signature = cookieValue.substring(lastDot + 1)

    // Web Crypto API (Edge-compatible, no Node.js crypto needed)
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )
    const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(value))
    const expectedSig = Array.from(new Uint8Array(signed))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")

    // Constant-time comparison (length check + char-by-char XOR)
    if (signature.length !== expectedSig.length) return false
    let mismatch = 0
    for (let i = 0; i < signature.length; i++) {
        mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i)
    }
    return mismatch === 0
}

export default auth(async (req) => {
    const { nextUrl } = req

    // On détecte la bêta via le hostname pour être infaillible
    const isBeta = nextUrl.hostname.includes('beta')

    if (isBeta) {
        const hasAccess = await verifyBetaCookie(req.cookies.get("beta_access")?.value)
        const isGatePage = nextUrl.pathname === "/gate"

        // On laisse passer les fichiers statiques, l'API d'auth et les assets publics
        const isPublicAsset = nextUrl.pathname.startsWith('/_next') ||
            nextUrl.pathname.startsWith('/api/auth') ||
            nextUrl.pathname.startsWith('/api/gate') ||
            nextUrl.pathname.startsWith('/assets') ||
            nextUrl.pathname.startsWith('/models') ||
            nextUrl.pathname.startsWith('/songes') ||
            nextUrl.pathname.startsWith('/uploads') ||
            /\.(png|jpg|jpeg|gif|svg|webp|ico|webmanifest|json|xml|txt)$/i.test(nextUrl.pathname)

        if (!hasAccess && !isGatePage && !isPublicAsset) {
            return NextResponse.redirect(new URL("/gate", nextUrl))
        }
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
