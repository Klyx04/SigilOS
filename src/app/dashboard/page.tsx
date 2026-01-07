import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { db } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Shield, PlusCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GuildSetupCard } from "@/components/guild-setup-card";

type GuildData = {
    id: string;
    name: string;
    icon: string | null;
};

async function getGuildsSeparated(userId: string) {
    // 1. Get all guilds where the Bot is active (from DB)
    const activeConfigs = await db.guildConfig.findMany({
        where: { isActive: true },
        select: { discordGuildId: true, name: true, iconUrl: true }
    });

    const { verifyGuildAccessibility } = await import("@/server/discord");

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

    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bearer ${account.access_token}` },
        next: { revalidate: 0 } // No cache for debug
    });

    if (!res.ok) return { active: [], pending: [] };

    const userGuilds = (await res.json()) as { id: string, name: string, icon: string, owner: boolean, permissions: string }[];

    // 3. Process Pending Candidates
    const pendingCandidates: { id: string, name: string, icon: string | null }[] = [];

    for (const guild of userGuilds) {
        if (activeIds.has(guild.id)) continue;

        // Check if Admin (Bitfield 0x8) or Owner
        const perms = BigInt(guild.permissions);
        const isAdmin = (perms & 0x8n) === 0x8n;

        if (isAdmin || guild.owner) {
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

    // Construct Active list: Intersection of (DB Active + Bot Accessible) AND (User is Member)
    const userGuildIds = new Set(userGuilds.map(ug => ug.id));

    const active: GuildData[] = validatedActive
        .filter(g => userGuildIds.has(g.discordGuildId))
        .map(g => ({
            id: g.discordGuildId,
            name: g.name,
            icon: g.iconUrl
        }));

    return { active, pending };
}

export default async function GuildSelectorPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    const { active, pending } = await getGuildsSeparated(session.user.id);
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.AUTH_DISCORD_ID || "";

    // Smart Redirect: ONLY if 1 active and NO pending (to avoid hiding setup options)
    // Actually, if I have 1 active but 5 pending, maybe I still want to go to active?
    // Let's stick to strict: Redirect only if 1 active matches ALL mutuals? 
    // No, existing logic was "If 1 guild, go there".
    // New logic: If 1 active and user isn't looking to setup (assumed), redirect.
    // BUT: Users might want to setup a new one. 
    // Compromise: Only redirect if pending is empty.
    // Smart Redirects
    if (active.length === 0 && pending.length === 0) {
        redirect("/");
    }

    // Direct access if only one active guild and user has no pending setups
    if (active.length === 1 && pending.length === 0) {
        redirect(`/dashboard/${active[0].id}`);
    }

    return (
        <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center p-4">
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-50" />

            <div className="relative z-10 max-w-4xl w-full space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-secondary">
                        Portail SigilOS
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Choisissez votre destination ou déployez le système sur un nouveau secteur.
                    </p>
                </div>

                <div className="grid gap-10 md:grid-cols-2">
                    {/* ACTIVE GUILDS */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-white/80 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-400" />
                            Guildes Actives
                        </h2>
                        {active.length > 0 ? (
                            <div className="grid gap-3">
                                {active.map((guild) => (
                                    <Link key={guild.id} href={`/dashboard/${guild.id}`} className="group">
                                        <Card className="bg-black/40 border-white/5 hover:border-primary/50 transition-all hover:scale-[1.02] cursor-pointer backdrop-blur-md">
                                            <CardContent className="p-4 flex items-center gap-4">
                                                <Avatar className="h-10 w-10 border-2 border-white/10 group-hover:border-primary transition-colors">
                                                    <AvatarImage src={guild.icon || ""} alt={guild.name} />
                                                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                                        {guild.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 overflow-hidden">
                                                    <h3 className="font-bold truncate text-foreground group-hover:text-primary transition-colors">
                                                        {guild.name}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        En ligne
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">Aucune guilde active.</p>
                        )}
                    </div>

                    {/* PENDING GUILDS */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-white/80 flex items-center gap-2">
                            <PlusCircle className="w-5 h-5 text-blue-400" />
                            Disponible pour déploiement
                        </h2>
                        {pending.length > 0 ? (
                            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {pending.map((guild) => (
                                    <GuildSetupCard key={guild.id} guild={guild} clientId={clientId} />
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 border border-dashed border-white/10 rounded-lg text-center text-muted-foreground bg-black/20">
                                <p className="text-sm">Aucun serveur éligible détecté.</p>
                                <p className="text-xs mt-1 text-muted-foreground/50">Vous devez être Administrateur pour déployer SigilOS.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
