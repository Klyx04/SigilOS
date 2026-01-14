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
            clientId: process.env.AUTH_DISCORD_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET,
            authorization: { params: { scope: "identify email guilds" } }
        })
    ],
    adapter: PrismaAdapter(prisma),
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account }) {
            console.log("[Auth] SignIn:", {
                user: user.id,
                accountProvider: account?.provider,
                hasAccessToken: !!account?.access_token,
            });
            return true;
        },
        async jwt({ token, account }) {
            if (account) {
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
                                console.log(`[Auth] Updated nickname for ${user.id}: ${nickname}`);
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
