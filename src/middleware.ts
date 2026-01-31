import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const { nextUrl } = req
    const isBeta = process.env.NEXT_PUBLIC_APP_URL?.includes('beta')

    // 1. Si on est en Bêta, on vérifie l'accès
    if (isBeta) {
        const hasAccess = req.cookies.get("beta_access")?.value === "true"
        const isGatePage = nextUrl.pathname === "/gate"

        // Si pas de cookie et pas sur la page de garde -> Redirection
        if (!hasAccess && !isGatePage) {
            return NextResponse.redirect(new URL("/gate", nextUrl))
        }
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
