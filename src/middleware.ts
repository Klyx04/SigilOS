import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const { nextUrl } = req

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
            nextUrl.pathname.endsWith('.png') ||
            nextUrl.pathname.endsWith('.jpg') ||
            nextUrl.pathname.endsWith('.svg') ||
            nextUrl.pathname === '/favicon.ico'

        if (!hasAccess && !isGatePage && !isPublicAsset) {
            return NextResponse.redirect(new URL("/gate", nextUrl))
        }
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
