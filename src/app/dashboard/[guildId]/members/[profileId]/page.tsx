import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getMemberProfile, getProfileStats } from "@/server/actions/profile-actions";
import { getGuildHeaderData } from "@/server/actions/guild-actions";
import { ProfileBentoGrid } from "@/components/profile/profile-bento-grid";
import { ArchiMatchingWidget } from "@/components/profile/archi-matching-widget";
import type { AvailabilityMap } from "@/lib/dofus-assets";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Palmtree } from "lucide-react";

export default async function MemberProfilePage({
    params,
}: {
    params: Promise<{ guildId: string; profileId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId, profileId } = await params;

    // Fetch member profile and guild data
    const [profileResult, guildData] = await Promise.all([
        getMemberProfile(guildId, profileId),
        getGuildHeaderData(guildId)
    ]);

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
    const displayName = discordNickname || profile.pseudoDofus || profile.user.name || "Membre";

    // Vacation status
    const now = new Date();
    const vacationStart = profile.vacationStart ? new Date(profile.vacationStart) : null;
    const vacationEnd = profile.vacationEnd ? new Date(profile.vacationEnd) : null;
    const isOnVacation = vacationStart && vacationStart <= now && (!vacationEnd || vacationEnd >= now);

    // Online Status (Active in last 2 minutes)
    const isOnline = profile.lastActivityAt && (now.getTime() - new Date(profile.lastActivityAt).getTime() < 2 * 60 * 1000);

    return (
        <div className="p-6 space-y-6">
            {/* Vacation Banner */}
            {isOnVacation && (
                <div className="flex items-center gap-3 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-300">
                    <Palmtree className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                    <span>
                        🏖️ <strong>{displayName}</strong> est absent
                        {vacationStart && ` du ${format(vacationStart, "d MMMM yyyy", { locale: fr })}`}
                        {vacationEnd ? ` au ${format(vacationEnd, "d MMMM yyyy", { locale: fr })}` : " (date de retour indéfinie)"}
                    </span>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">Profil de {displayName}</h1>
                    {isOnline && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">En ligne</span>
                        </div>
                    )}
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
                    fmPriceClassic: profile.fmPriceClassic,
                    fmPriceTrans: profile.fmPriceTrans,
                    fmPriceExo: profile.fmPriceExo,
                    availability: (profile.availability as AvailabilityMap) || {},
                    vacationStart: profile.vacationStart ? new Date(profile.vacationStart) : null,
                    vacationEnd: profile.vacationEnd ? new Date(profile.vacationEnd) : null,
                    vacationNotify: profile.vacationNotify || false,
                    altPseudos: (profile.altPseudos as string[]) || [],
                    metamobPseudo: profile.metamobPseudo,
                    metamobVerified: profile.metamobVerified,
                    metamobLastSync: profile.metamobLastSync ? new Date(profile.metamobLastSync) : null,
                    dofusBookLinks: (profile.dofusBookLinks as any) || [],
                }}
                user={{
                    name: profile.user.name,
                    image: profile.user.image,
                }}
                stats={stats}
                guildId={guildId}
                guildName={guildData.name}
                discordNickname={discordNickname}
                roleColor={roleColor}
                readOnly={true}
                isAdmin={profile.discordInfo?.isAdmin || false}
            />

            {/* Archi Matching Widget - shows potential exchanges */}
            <ArchiMatchingWidget
                guildId={guildId}
                profileId={profileId}
                ownerDisplayName={displayName}
            />
        </div>
    );
}

