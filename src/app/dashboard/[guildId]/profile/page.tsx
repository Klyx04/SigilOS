import { auth } from "@/auth";
import { getUserProfile, getProfileStats } from "@/server/actions/profile-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { ProfileBentoGrid } from "@/components/profile/profile-bento-grid";
import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
import type { AvailabilityMap } from "@/lib/dofus-assets";
import AccessDenied from "@/components/access-denied";

export default async function ProfilePage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Fetch user context for Discord info + RBAC
    const userContext = await getUserContext(guildId);

    // RBAC: Must be authenticated member of the guild
    if (!userContext.isAuthenticated || !userContext.isMember) {
        return <AccessDenied />;
    }

    // Fetch profile
    const profileResponse = await getUserProfile(guildId);

    if (!profileResponse.success || !profileResponse.data) {
        return (
            <div className="p-8 text-center text-red-400">
                <h2 className="text-xl font-bold">Erreur de chargement</h2>
                <p>{profileResponse.error}</p>
            </div>
        );
    }

    const profile = profileResponse.data;

    // Fetch stats
    const statsResponse = await getProfileStats(guildId);
    const stats = statsResponse.success && statsResponse.data
        ? {
            ...statsResponse.data,
            joinedAt: userContext.joinedAt ?? statsResponse.data.joinedAt
        }
        : {
            xp: profile.xp || 0,
            weeklyXp: 0,
            guildatons: profile.guildatons || 0,
            missionsValidated: 0,
            weeklyMissions: 0,
            lastActivity: null,
            joinedAt: userContext.joinedAt || null,
            isTopContributor: false,
        };

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AuroraBackground className="absolute inset-0 z-0 opacity-20 pointer-events-none" />

            <div className="relative z-10 p-6 max-w-6xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Mon Profil</h1>
                    <p className="text-zinc-400">Gérez votre identité de guilde, votre classe et vos métiers.</p>
                </div>

                <ProfileBentoGrid
                    profile={{
                        id: profile.id,
                        pseudoDofus: profile.pseudoDofus,
                        classe: profile.classe,
                        classeSecondaires: (profile.classeSecondaires as string[]) || [],
                        metiers: (profile.metiers as string[]) || [],
                        forgemagieStatus: profile.forgemagieStatus,
                        availability: (profile.availability as AvailabilityMap) || {},
                        vacationStart: profile.vacationStart ? new Date(profile.vacationStart) : null,
                        vacationEnd: profile.vacationEnd ? new Date(profile.vacationEnd) : null,
                        vacationNotify: profile.vacationNotify || false,
                        metamobPseudo: profile.metamobPseudo,
                        metamobVerified: profile.metamobVerified,
                        metamobLastSync: profile.metamobLastSync ? new Date(profile.metamobLastSync) : null,
                        altPseudos: (profile.altPseudos as string[]) || [],
                    }}
                    user={{
                        name: profile.user.name,
                        image: profile.user.image,
                    }}
                    stats={stats}
                    guildId={guildId}
                    discordNickname={userContext.name}
                    roleColor={userContext.roleColor}
                    readOnly={false}
                />
            </div>
        </div>
    );
}
