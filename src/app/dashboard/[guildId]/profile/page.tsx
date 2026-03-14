import { auth } from "@/auth";
import { getUserProfile, getProfileStats } from "@/server/actions/profile-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { ProfileBentoGrid } from "@/components/profile/profile-bento-grid";
import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
import type { AvailabilityMap } from "@/lib/dofus-assets";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { UserCircle } from "lucide-react";

export default async function ProfilePage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Fetch all data in parallel to avoid waterfalls
    const [userContext, profileResponse, statsResponse] = await Promise.all([
        getUserContext(guildId),
        getUserProfile(guildId),
        getProfileStats(guildId)
    ]);

    // RBAC: Must be authenticated member of the guild with profile view permission
    if (!userContext.isAuthenticated || !userContext.isMember || !userContext.canViewProfile) {
        return <AccessDenied />;
    }

    if (!profileResponse.success || !profileResponse.data) {
        return (
            <div className="p-8 text-center text-red-400">
                <h2 className="text-xl font-bold">Erreur de chargement</h2>
                <p>{profileResponse.error}</p>
            </div>
        );
    }

    const profile = profileResponse.data;
    const stats = statsResponse.success && statsResponse.data
        ? {
            ...statsResponse.data,
            joinedAt: (userContext.joinedAt ?? statsResponse.data.joinedAt) as string | null
        }
        : {
            xp: profile.xp || 0,
            weeklyXp: 0,
            guildatons: profile.guildatons || 0,
            missionsValidated: 0,
            weeklyMissions: 0,
            lastActivity: null as { description: string; date: string | Date } | null,
            joinedAt: (userContext.joinedAt || null) as string | null,
            isTopContributor: false,
        };

    return (
        <div className="relative min-h-[calc(100vh-4rem)] pb-12">
            <AuroraBackground className="absolute inset-0 z-0 opacity-20 pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto space-y-8">
                <UnifiedModuleHeader
                    title="Mon Profil"
                    description="Gérez votre identité de guilde, votre classe et vos métiers."
                    imageSrc="/assets/ui/icons/profile.png"
                    backHref={`/dashboard/${guildId}`}
                />

                <ProfileBentoGrid
                    profile={{
                        id: profile.id,
                        userId: profile.userId,
                        pseudoDofus: profile.pseudoDofus,
                        classe: profile.classe,
                        classeSecondaires: (profile.classeSecondaires as string[]) || [],
                        metiers: (profile.metiers as string[]) || [],
                        forgemagieStatus: profile.forgemagieStatus,
                        fmPriceClassic: profile.fmPriceClassic,
                        fmPriceTrans: profile.fmPriceTrans,
                        fmPriceExo: profile.fmPriceExo,
                        availability: (profile.availability as AvailabilityMap) || {},
                        vacationStart: profile.vacationStart ? new Date(profile.vacationStart) : null,
                        vacationEnd: profile.vacationEnd ? new Date(profile.vacationEnd) : null,
                        vacationNotify: profile.vacationNotify || false,
                        metamobPseudo: profile.metamobPseudo,
                        metamobVerified: profile.metamobVerified,
                        metamobLastSync: profile.metamobLastSync ? new Date(profile.metamobLastSync) : null,
                        altPseudos: (profile.altPseudos as string[]) || [],
                        dofusBookLinks: (profile.dofusBookLinks as any) || [],
                        introduction: profile.introduction,
                        notificationPrefs: profile.notificationPrefs as any,
                        successPoints: profile.successPoints,
                        lastLadderUpdate: profile.lastLadderUpdate ? new Date(profile.lastLadderUpdate) : null,
                        roleGrants: profile.roleGrants || [],
                    }}
                    user={{
                        name: profile.user.name,
                        image: profile.user.image,
                    }}
                    stats={stats}
                    guildId={guildId}
                    guildName={userContext.guildName}
                    dofusServerId={userContext.dofusServerId}
                    discordNickname={userContext.name}
                    isAdmin={userContext.isAdmin}
                    permissions={{
                        canViewArchis: userContext.canViewArchis,
                        canViewSonges: userContext.canViewSonges,
                        canViewLadder: userContext.canViewLadder,
                        canViewMissions: userContext.canViewMissions,
                    }}
                    roleName={userContext.roleName}
                    roleColor={userContext.roleColor}
                    readOnly={false}
                    isSuperAdmin={userContext.isSuperAdmin}
                />
            </div>
        </div>
    );
}
