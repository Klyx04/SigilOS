import type { NextAuthConfig } from "next-auth"

/**
 * Auth.js Security Configuration
 * Follows OWASP Session Management Best Practices
 * https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
 */
export const authConfig = {
    providers: [], // Providers are defined in auth.ts to avoid Edge issues
    secret: process.env.AUTH_SECRET,

    // Session Configuration
    session: {
        strategy: "jwt",
        maxAge: 7 * 24 * 60 * 60,      // 7 days - reasonable for a dashboard app
        updateAge: 24 * 60 * 60,       // Refresh JWT every 24 hours (sliding session)
    },

    // Cookie Security Settings - Simplified for production stability
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },

    // Security Options
    trustHost: true, // Needed for proper domain handling behind proxies/load balancers

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

    // Custom Pages
    pages: {
        error: "/auth/error",
        // signIn: "/", // Redirect signin to landing page
    },
} satisfies NextAuthConfig
