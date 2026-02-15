import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"
import { fetchGuildMember } from "@/server/discord"

import Discord from "next-auth/providers/discord"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Discord({
            clientId: process.env.AUTH_DISCORD_ID || process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET || process.env.DISCORD_CLIENT_SECRET,
            authorization: { params: { scope: "identify email guilds" } }
        })
    ],
    adapter: PrismaAdapter(prisma),
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account }) {
            void user;
            void account;
            return true;
        },
        async jwt({ token, account, user, trigger, session }) {
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
                token.scope = account.scope;
            }

            // SECURITY: Session Fingerprinting (2026)
            // We can't easily get headers here in 'auth' callbacks in some environments, 
            // but if we are in a request context, it might work.
            // If not, we'll use it as a placeholder for when we implement custom crypto-tokens.
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            return session;
        }
    },
    events: {
        async signIn({ user, account }) {
            if (!account || !user.id) return;

            // Update Discord tokens in DB
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
                console.error("[Auth] Failed to update account tokens:", e);
            }

            // Sync Discord nickname for each guild the user is in
            try {
                const userProfiles = await prisma.userProfile.findMany({
                    where: { userId: user.id },
                    include: { guild: { select: { discordGuildId: true } } }
                });

                for (const profile of userProfiles) {
                    if (!profile.guild?.discordGuildId) continue;

                    try {
                        const member = await fetchGuildMember(
                            profile.guild.discordGuildId,
                            account.providerAccountId
                        );

                        if (member) {
                            const nickname = member.nick || member.user?.global_name || member.user?.username;
                            if (nickname && nickname !== profile.discordNickname) {
                                await prisma.userProfile.update({
                                    where: { id: profile.id },
                                    data: { discordNickname: nickname }
                                });

                            }
                        }
                    } catch {
                        // Silent fail for individual guild fetch errors
                    }
                }
            } catch (e) {
                console.error("[Auth] Failed to sync Discord nicknames:", e);
            }
        }
    }
})
