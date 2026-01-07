import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"

import Discord from "next-auth/providers/discord"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Discord({
            clientId: process.env.AUTH_DISCORD_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET,
            authorization: { params: { scope: "identify email guilds" } }
        })
    ],
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account, profile }) {
            console.log("[Auth-Debug] SignIn:", {
                user: user.id,
                accountProvider: account?.provider,
                hasAccessToken: !!account?.access_token,
                scope: account?.scope
            });
            return true;
        },
        async jwt({ token, account }) {
            if (account) {
                console.log("[Auth-Debug] JWT Update:", {
                    sub: token.sub,
                    hasAccessToken: !!account.access_token,
                    scope: account.scope
                });
                // Wait, adapter is prisma, so 'session.strategy' defaults to 'database' usually unless overriden.
                // Ah, line 9 says: session: { strategy: "jwt" }.
                // IF STRATEGY IS JWT, THE DB ACCOUNT MIGHT NOT BE UPDATED AUTOMATICALLY BY ADAPTER ON RE-LOGIN IN SOME VERSIONS?
                // OR WE NEED TO MANUALLY UPDATE IT?
                // Let's check if we are using "database" or "jwt" strategy.
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
                token.scope = account.scope;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            // Also map other fields if needed, like access_token for client use if exposed
            // But main blocker is ID.
            return session;
        }
    },
    events: {
        async signIn({ user, account }) {
            // FORCE UPDATE ACCOUNT IN DB to ensure fresh tokens/scopes
            if (account && user.id) {
                try {
                    await prisma.account.updateMany({
                        where: { userId: user.id, provider: "discord" },
                        data: {
                            access_token: account.access_token,
                            refresh_token: account.refresh_token,
                            expires_at: account.expires_at,
                            scope: account.scope
                        }
                    });
                } catch (e) {
                    // Silent fail or specialized logger
                }
            }
        }
    }
})
