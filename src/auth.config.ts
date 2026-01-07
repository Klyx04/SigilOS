import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    providers: [], // Providers are defined in auth.ts to avoid Edge issues
    secret: process.env.AUTH_SECRET,
    session: { strategy: "jwt" },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')

            if (isOnDashboard) {
                if (isLoggedIn) return true
                return false // Redirect unauthenticated users to login page
            }
            return true
        },
    },
} satisfies NextAuthConfig

