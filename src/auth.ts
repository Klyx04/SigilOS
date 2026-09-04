import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"
import { fetchGuildMember } from "@/server/discord"
import { logger } from "@/lib/logger"

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
    // SECURITY (F-07 / audit 2026): the base authConfig defines maxAge 24h, but
    // this override previously raised it to 7 days (most permissive wins).
    // NIST SP 800-63B recommends short sessions — set maxAge to 8h with a 4h
    // rotation so a banned/kicked user loses access quickly.
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60,   // 8 hours (NIST-aligned)
        updateAge: 4 * 60 * 60, // rotate the JWT every 4 hours
    },
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

                // 1b. Check PlatformBan for user
                try {
                    const userBan = await prisma.platformBan.findFirst({
                        where: { discordId, entityType: "USER" }
                    });
                    if (userBan) {
                        logger.warn(`[Auth Security] Blocked sign-in for banned user ${discordId}: ${userBan.reason}`);
                        return "/auth/error?error=Banned";
                    }
                } catch (e) {
                    logger.error("[Auth Security] Error checking platformBan for user:", { error: (e as Error).message });
                }

                // Helper fail-closed : journalise le refus (observabilité God) puis
                // renvoie le résultat du sign-in (false = refus sans redirect ciblée).
                const deny = async (reason: "NO_MANAGED_GUILD" | "DISCORD_API_ERROR", withManagedGuildError: boolean) => {
                    try {
                        const { logAccessAttempt } = await import("@/lib/access-attempt");
                        await logAccessAttempt(discordId, reason);
                    } catch { /* non bloquant */ }
                    logger.warn(`[Auth Security] Blocked sign-in for user ${discordId}: ${reason}.`);
                    return withManagedGuildError ? "/auth/error?error=NoManagedGuild" : false;
                };

                // Helper fail-open CIBLÉ : tolère une API Discord KO/en retard UNIQUEMENT
                // si l'utilisateur est déjà un membre ACTIVE connu d'une guilde gérée.
                // Un inconnu reste refusé (fail-closed). Voir src/lib/access-attempt.ts.
                const isKnownManagedMember = async (): Promise<boolean> => {
                    try {
                        const { hasActiveProfileInManagedGuild } = await import("@/lib/access-attempt");
                        return await hasActiveProfileInManagedGuild(discordId);
                    } catch {
                        return false;
                    }
                };

                // 2. Fetch User Guilds from Discord API
                try {
                    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
                        headers: { Authorization: `Bearer ${account.access_token}` }
                    });
                    if (!res.ok) {
                        logger.error("[Auth Security] Failed to fetch user guilds from Discord:", { status: res.status });
                        // API KO (rate-limit/5xx) : autorise uniquement un membre connu, sinon refus fail-closed.
                        if (await isKnownManagedMember()) return true;
                        return deny("DISCORD_API_ERROR", false);
                    }
                    const userGuilds = await res.json() as { id: string; owner?: boolean; permissions?: string }[];
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

                    // 5. Onboarding Autonome : Si l'utilisateur est propriétaire ou administrateur
                    // d'au moins un serveur Discord non banni, on l'autorise à entrer sur le portail
                    // pour qu'il puisse déployer SigilOS en un clic.
                    const adminGuilds = userGuilds.filter(g => {
                        if (g.owner) return true;
                        if (!g.permissions) return false;
                        try {
                            return (BigInt(g.permissions) & 0x8n) === 0x8n;
                        } catch {
                            return false;
                        }
                    });

                    if (adminGuilds.length > 0) {
                        const adminGuildIds = adminGuilds.map(g => g.id);
                        const bannedGuilds = await prisma.platformBan.findMany({
                            where: { discordId: { in: adminGuildIds }, entityType: "GUILD" },
                            select: { discordId: true }
                        });
                        const bannedSet = new Set(bannedGuilds.map(b => b.discordId));
                        const eligibleAdminGuilds = adminGuilds.filter(g => !bannedSet.has(g.id));

                        if (eligibleAdminGuilds.length > 0) {
                            return true;
                        }
                    }

                    // 6. Discord OK mais la guilde n'est pas encore remontée (latence) :
                    //    on tolère un membre ACTIVE connu d'une guilde gérée.
                    if (await isKnownManagedMember()) return true;

                    return deny("NO_MANAGED_GUILD", true); // Redirect to specific error page
                } catch (e) {
                    logger.error("[Auth Security] Critical error during sign-in check:", { error: (e as Error).message });
                    if (await isKnownManagedMember()) return true;
                    return deny("DISCORD_API_ERROR", false);
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
                logger.warn(`[Auth] Discord token expired for user ${token.discordId} — forcing re-auth`);
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
                // GOD bypass flag — stored in session for use by middleware cookie
                const superAdminIds = (process.env.SUPER_ADMIN_IDS || "")
                    .split(",")
                    .map((id) => id.trim())
                    .filter(Boolean);
                anySession.isGod = !!(token.discordId && superAdminIds.includes(token.discordId as string));
            }
            return session;
        }
    },
    events: {
        async signIn({ user, account }) {
            if (!account || !user.id) return;

            // Update Discord tokens in DB — SECURITY (F-05): encrypted via the
            // explicit token-encryption service. A bare updateMany bypassed the
            // Prisma $extends encryption hooks and wrote tokens in plaintext.
            try {
                const { updateEncryptedDiscordTokens } = await import("./lib/token-encryption");
                await updateEncryptedDiscordTokens(user.id, {
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expires_at: account.expires_at,
                    scope: account.scope,
                });
            } catch (e) {
                logger.error("[Auth] Failed to update encrypted account tokens:", { error: (e as Error).message });
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
                logger.error("[Auth] Failed to sync Discord nicknames:", { error: (e as Error).message });
            }
        }
    }
})
