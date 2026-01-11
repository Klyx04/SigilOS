import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getMemberProfile, getProfileStats } from "@/server/actions/profile-actions";
import { ProfileBentoGrid } from "@/components/profile/profile-bento-grid";
import type { AvailabilityMap } from "@/lib/dofus-assets";

export default async function MemberProfilePage({
    params,
}: {
    params: Promise<{ guildId: string; profileId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId, profileId } = await params;

    // Fetch member profile (includes Discord info)
    const profileResult = await getMemberProfile(guildId, profileId);
    if (!profileResult.success || !profileResult.data) {
        notFound();
    }

    const profile = profileResult.data;

    // Build stats object
    // Build stats object
    const stats = {
        xp: profile.xp || 0,
        weeklyXp: profile.weeklyXp || 0,
        missionsValidated: profile.validatedMissionsCount || 0,
        weeklyMissions: profile.weeklyMissions || 0,
        joinedAt: profile.discordInfo?.joinedAt ? new Date(profile.discordInfo.joinedAt) : null,
        lastActivity: profile.lastActivityAt
            ? { description: "Activité", date: new Date(profile.lastActivityAt) }
            : null,
        isTopContributor: (profile.xp || 0) >= 1000,
    };

    // Role color from Discord
    const roleColor = profile.discordInfo?.roleColor || 0;
    const discordNickname = profile.discordInfo?.nickname || null;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Profil de {discordNickname || profile.pseudoDofus || profile.user.name}</h1>
                    <p className="text-sm text-zinc-400">Profil en lecture seule</p>
                </div>
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
                }}
                user={{
                    name: profile.user.name,
                    image: profile.user.image,
                }}
                stats={stats}
                guildId={guildId}
                discordNickname={discordNickname}
                roleColor={roleColor}
                readOnly={true}
            />
        </div>
    );
}
