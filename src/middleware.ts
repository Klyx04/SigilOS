import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const { nextUrl } = req
    console.log(`[Middleware] Request: ${nextUrl.pathname}`);

    // On détecte la bêta via le hostname pour être infaillible
    const isBeta = nextUrl.hostname.includes('beta')

    if (isBeta) {
        const hasAccess = req.cookies.get("beta_access")?.value === "true"
        const isGatePage = nextUrl.pathname === "/gate"

        // On laisse passer les fichiers statiques, l'API d'auth et les assets publics
        const isPublicAsset = nextUrl.pathname.startsWith('/_next') ||
            nextUrl.pathname.startsWith('/api/auth') ||
            nextUrl.pathname.startsWith('/assets') ||
            nextUrl.pathname.startsWith('/models') ||
            nextUrl.pathname.startsWith('/songes') ||
            nextUrl.pathname.startsWith('/uploads') ||
            /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(nextUrl.pathname)

        if (!hasAccess && !isGatePage && !isPublicAsset) {
            return NextResponse.redirect(new URL("/gate", nextUrl))
        }
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
