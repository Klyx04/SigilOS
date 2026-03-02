import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { db } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight, Shield, PlusCircle, LayoutDashboard, Crown, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { GuildSetupCard } from "@/components/guild-setup-card";
import { NoGuildMessage } from "@/components/no-guild-message";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";

type GuildData = {
    id: string;
    name: string;
    icon: string | null;
    isAdmin: boolean;
};

import { unstable_cache } from "next/cache";

// Cached fetcher for Discord Guilds
// Caches based on access_token, so it's unique per user and invalidates on token refresh
const getCachedDiscordGuilds = unstable_cache(
    async (accessToken: string) => {
        try {
            const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
                headers: { Authorization: `Bearer ${accessToken}` },
                next: { revalidate: 300 } // Keep this to ensure internal fetch also respects it, though unstable_cache handles it
            });

            if (!res.ok) {
                return { error: true, status: res.status, data: [] };
            }

            const data = await res.json();
            return { error: false, status: 200, data };
        } catch (e) {
            console.error("[Dashboard] Fetch error:", e);
            return { error: true, status: 500, data: [] };
        }
    },
    ['discord-user-guilds-v1'],
    { revalidate: 300 } // 5 minutes cache
);

async function getGuildsSeparated(userId: string) {
    // 1. Get all guilds where the Bot is active (from DB)
    const activeConfigs = await db.guildConfig.findMany({
        where: { isActive: true },
        select: { discordGuildId: true, name: true, iconUrl: true }
    });

    const { verifyGuildAccessibility } = await import("@/server/discord");
    // Fetch allowed guilds for WhiteList check (managed via GOD dashboard only)
    const allowedGuildsDB = await db.allowedGuild.findMany({
        where: { isActive: true },
        select: { discordGuildId: true }
    });
    const allowedIdsWhitelist = new Set(allowedGuildsDB.map(g => g.discordGuildId));

    // Only show guilds that are explicitly whitelisted in GOD
    const isAllowedForDeployment = (guildId: string) => {
        return allowedIdsWhitelist.has(guildId);
    };


    // Run checks for Active (DB) guilds
    const validatedActive = await Promise.all(
        activeConfigs.map(async (g) => {
            const isAccessible = await verifyGuildAccessibility(g.discordGuildId);
            return { ...g, isAccessible };
        })
    ).then(results => results.filter(r => r.isAccessible));

    const activeIds = new Set(validatedActive.map(g => g.discordGuildId));

    // 2. Fetch User's guilds from Discord API
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { access_token: true }
    });

    if (!account?.access_token) return { active: [], pending: [] };

    // USE CACHED FETCH
    const { error, status, data: userGuildsData } = await getCachedDiscordGuilds(account.access_token);

    if (error) {
        console.error(`[Dashboard] Discord API error fetching user guilds: ${status}`);

        // Fallback: Check database for user's existing profiles
        const dbProfiles = await db.userProfile.findMany({
            where: {
                userId,
                status: "ACTIVE"
            },
            include: {
                guild: true
            }
        });

        if (dbProfiles.length > 0) {
            // User has active profiles, use those guilds (filtered by whitelist)
            const activeFromDb: GuildData[] = dbProfiles
                .filter(p => allowedIdsWhitelist.has(p.guild.discordGuildId))
                .map(p => ({
                    id: p.guild.discordGuildId,
                    name: p.guild.name,
                    icon: p.guild.iconUrl,
                    isAdmin: false // Fallback: assumes member access only if API fails
                }));
            return { active: activeFromDb, pending: [] };
        }

        return { active: [], pending: [], rateLimited: status === 429 };
    }

    // 3. Process Pending Candidates
    const pendingCandidates: { id: string, name: string, icon: string | null }[] = [];

    // Safe cast since we verified success
    const userGuilds = userGuildsData as { id: string, name: string, icon: string, owner: boolean, permissions: string }[];

    for (const guild of userGuilds) {
        if (activeIds.has(guild.id)) continue;

        // Check if Admin (Bitfield 0x8) or Owner
        const perms = BigInt(guild.permissions);
        const isAdmin = (perms & 0x8n) === 0x8n;

        // AUTH CHECK: Must be Admin AND Whitelisted (if Closed Beta)
        if ((isAdmin || guild.owner) && isAllowedForDeployment(guild.id)) {
            pendingCandidates.push({
                id: guild.id,
                name: guild.name,
                icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null
            });
        }
    }

    // Check Bot Presence for Pending candidates
    const pending = await Promise.all(pendingCandidates.map(async (g) => {
        const isBotPresent = await verifyGuildAccessibility(g.id);
        return { ...g, isBotPresent };
    }));

    // Construct Active list: Intersection of (DB Active + Bot Accessible + Whitelisted) AND (User is Member)
    const userGuildIds = new Set(userGuilds.map(ug => ug.id));

    const active: GuildData[] = validatedActive
        .filter(g => userGuildIds.has(g.discordGuildId) && allowedIdsWhitelist.has(g.discordGuildId))
        .map(g => {
            const userGuild = userGuilds.find(ug => ug.id === g.discordGuildId);
            const perms = userGuild ? BigInt(userGuild.permissions) : 0n;
            const isAdmin = userGuild?.owner || (perms & 0x8n) === 0x8n;

            return {
                id: g.discordGuildId,
                name: g.name,
                icon: g.iconUrl,
                isAdmin: !!isAdmin
            };
        });

    return { active, pending, rateLimited: false };
}

export default async function GuildSelectorPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    const { active, pending, rateLimited } = await getGuildsSeparated(session.user.id);
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.AUTH_DISCORD_ID || "";

    // Smart Redirect disabled to show the portal
    // if (active.length === 1 && pending.length === 0) {
    //     redirect(`/dashboard/${active[0].id}`);
    // }

    // Check if empty
    const isEmpty = active.length === 0 && pending.length === 0;

    return (
        <div className="relative min-h-screen w-full overflow-hidden flex flex-col bg-zinc-950 font-sans selection:bg-accent-teal/30 landing-theme">
            <AuroraBackground className="absolute inset-0 z-0 pointer-events-none opacity-40" />
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05),transparent_50% )] pointer-events-none" />

            <PublicHeader user={session.user} dashboardHref="/dashboard" isMember={active.length > 0} />

            <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 pt-24 pb-24 overflow-y-auto custom-scrollbar">

                {isEmpty ? (
                    <NoGuildMessage rateLimited={rateLimited} />
                ) : (
                    <div className="relative z-10 max-w-5xl w-full space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">

                        {/* Hero Section */}
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest text-emerald-400 backdrop-blur-md">
                                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Portail Unifié</span>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-2 font-heading">
                                Votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-emerald-200">QG Galactique</span>
                            </h1>
                            <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-medium">
                                Accédez à vos guildes actives ou déployez SigilOS si votre serveur est autorisé.
                            </p>
                        </div>

                        <div className={cn(
                            "grid gap-8",
                            pending.length > 0 ? "lg:grid-cols-12" : "lg:grid-cols-1"
                        )}>

                            {/* ACTIVE GUILDS COLUMN */}
                            <div className={cn(
                                "space-y-6",
                                pending.length > 0 ? "lg:col-span-7" : "lg:col-span-12"
                            )}>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <Shield className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        Guildes Actives
                                    </h2>
                                    <span className="text-xs font-medium px-2 py-1 rounded-md bg-zinc-900 border border-white/5 text-zinc-500">
                                        {active.length} disponible{active.length > 1 ? 's' : ''}
                                    </span>
                                </div>

                                {active.length > 0 ? (
                                    <div className="grid gap-4">
                                        {active.map((guild) => (
                                            <Link key={guild.id} href={`/dashboard/${guild.id}`} className="group block">
                                                <GlassPanel className="p-0 hover:border-indigo-500/50 transition-all duration-300 group-hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)] group-hover:scale-[1.01]">
                                                    <div className="p-5 flex items-center gap-5">
                                                        <div className="relative">
                                                            <Avatar className="h-14 w-14 rounded-2xl border-2 border-white/10 group-hover:border-indigo-400/50 transition-colors shadow-lg">
                                                                <AvatarImage src={guild.icon || ""} alt={guild.name} className="object-cover" />
                                                                <AvatarFallback className="bg-zinc-800 text-zinc-400 font-bold rounded-2xl">
                                                                    {guild.name.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                                                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                            </div>
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                                                                {guild.name}
                                                            </h3>
                                                            <p className="text-sm text-zinc-500 flex items-center gap-2 mt-0.5">
                                                                <span className="text-emerald-400 font-medium text-xs uppercase tracking-wider">Opérationnel</span>
                                                                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                                                <span className={cn("truncate", guild.isAdmin ? "text-indigo-400" : "text-zinc-500")}>
                                                                    {guild.isAdmin ? "Administrateur" : "Accès Membre"}
                                                                </span>
                                                            </p>
                                                        </div>

                                                        <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                                                            <ChevronRight className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                </GlassPanel>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <GlassPanel className="p-8 text-center border-dashed border-white/10">
                                        <p className="text-zinc-500 italic">Aucune guilde active trouvée.</p>
                                    </GlassPanel>
                                )}
                            </div>

                            {/* PENDING GUILDS COLUMN - Only show if there are pending guilds */}
                            {pending.length > 0 && (
                                <div className="lg:col-span-5 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                <PlusCircle className="w-5 h-5 text-amber-400" />
                                            </div>
                                            Déploiement
                                        </h2>
                                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-zinc-900 border border-white/5 text-zinc-500">
                                            Admin requis
                                        </span>
                                    </div>

                                    <GlassPanel className="min-h-[200px] border-white/5 bg-zinc-900/40">
                                        <div className="p-4 border-b border-white/5 bg-white/5 rounded-t-xl mb-2">
                                            <p className="text-xs text-zinc-400 leading-relaxed">
                                                Les serveurs ci-dessous sont éligibles pour l'installation de SigilOS car vous y disposez des droits d'administrateur.
                                            </p>
                                        </div>

                                        <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {pending.length > 0 ? (
                                                pending.map((guild) => (
                                                    <GuildSetupCard key={guild.id} guild={guild} clientId={clientId} />
                                                ))
                                            ) : (
                                                <div className="py-12 px-6 text-center">
                                                    <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                                                        <Crown className="w-6 h-6 text-zinc-600" />
                                                    </div>
                                                    <p className="text-sm font-medium text-zinc-300">Aucun serveur éligible</p>
                                                    <p className="text-xs text-zinc-500 mt-1 max-w-[250px] mx-auto">
                                                        Aucun nouveau serveur éligible trouvé. Assurez-vous d'être proprétaire ou administrateur.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </GlassPanel>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <GalacticFooter isMember={active.length > 0} />
        </div>
    );
}
