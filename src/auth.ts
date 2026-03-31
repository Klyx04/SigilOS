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
            authorization: { params: { scope: "identify guilds" } }
        })
    ],
    adapter: PrismaAdapter(prisma),
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account, profile }) {
            if (account?.provider === "discord") {
                const discordId = account.providerAccountId;

                // 1. Check SuperAdmin bypass
                const superAdminIds = (process.env.SUPER_ADMIN_IDS || "")
                    .split(",")
                    .map(id => id.trim())
                    .filter(Boolean);
                if (discordId && superAdminIds.includes(discordId)) return true;

                // 2. Fetch User Guilds from Discord API
                try {
                    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
                        headers: { Authorization: `Bearer ${account.access_token}` }
                    });
                    if (!res.ok) {
                        console.error("[Auth Security] Failed to fetch user guilds from Discord:", res.status);
                        // If rate limited or error, we might want to either block or allow.
                        // Better block for security if we can't verify membership.
                        return false;
                    }
                    const userGuilds = await res.json() as { id: string }[];
                    const userGuildIds = userGuilds.map(g => g.id);

                    // 3. Check if any guild is registered in SigilOS
                    const registeredCount = await prisma.guildConfig.count({
                        where: { discordGuildId: { in: userGuildIds } }
                    });

                    if (registeredCount > 0) return true;

                    // 4. Fallback search in AllowedGuild (whitelist) 
                    // To allow owners of new guilds to sign in before the bot is added
                    const allowedCount = await prisma.allowedGuild.count({
                        where: { discordGuildId: { in: userGuildIds }, isActive: true }
                    });

                    if (allowedCount > 0) return true;

                    console.warn(`[Auth Security] Blocked sign-in for user ${discordId}: Not a member of any managed guild.`);
                    return "/auth/error?error=NoManagedGuild"; // Redirect to specific error page
                } catch (e) {
                    console.error("[Auth Security] Critical error during sign-in check:", e);
                    return false;
                }
            }
            return true;
        },
        // SECURITY FIX: Validate callbackUrl to prevent Open Redirect (Google Safe Browsing flag)
        async redirect({ url, baseUrl }) {
            // Allow relative URLs (e.g. /dashboard/...)
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            // Allow same-origin
            try {
                if (new URL(url).origin === new URL(baseUrl).origin) return url;
            } catch {
                // Malformed URL — fallback to baseUrl
            }
            // Reject all external redirects
            return baseUrl;
        },
        async jwt({ token, account, user }) {
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
                token.scope = account.scope;
                // Store discord ID specifically for permissions
                token.discordId = account.providerAccountId;
                // Clear any previous error on fresh sign-in
                delete (token as any).error;
            }
            if (user) {
                token.role = (user as any).role;
            }

            // SECURITY FIX: Check if Discord OAuth token has expired
            // Discord access tokens expire after 7 days — force re-auth if expired
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (token.expiresAt && typeof token.expiresAt === 'number' && token.expiresAt < nowSeconds) {
                console.warn(`[Auth] Discord token expired for user ${token.discordId} — forcing re-auth`);
                return { ...token, error: "DiscordTokenExpired" } as any;
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
                
                // PERFORMANCE OPTIM: Add discordId to session to avoid constant Account lookups
                const anySession = session as any;
                if (token.discordId) {
                    anySession.user.discordId = token.discordId;
                }
                if (token.role) {
                    anySession.user.role = token.role;
                }
                // SECURITY FIX: Propagate token expiry error to session
                // Client-side layout will detect this and force signOut()
                if ((token as any).error) {
                    anySession.error = (token as any).error;
                }
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
