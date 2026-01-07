import type { NextAuthConfig } from "next-auth"
import Discord from "next-auth/providers/discord"

export const authConfig = {
    providers: [
        Discord({
            authorization: { params: { scope: "identify email guilds" } }
        })
    ],
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
