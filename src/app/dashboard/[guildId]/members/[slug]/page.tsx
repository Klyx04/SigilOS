import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getMemberProfileBySlug } from "@/server/actions/profile-actions";
import { getGuildHeaderData } from "@/server/actions/guild-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { ProfileBentoGrid } from "@/components/profile/profile-bento-grid";
import { ArchiMatchingWidget } from "@/components/profile/archi-matching-widget";
import type { AvailabilityMap } from "@/lib/dofus-assets";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Palmtree } from "lucide-react";
import { SolicitAction } from "@/components/profile/solicit-action";
import { getDisplayName } from "@/lib/display-name";

export default async function MemberProfilePage({
    params,
}: {
    params: Promise<{ guildId: string; slug: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId, slug } = await params;

    const [profileResult, guildData, viewerContext] = await Promise.all([
        getMemberProfileBySlug(guildId, slug),
        getGuildHeaderData(guildId),
        getUserContext(guildId)
    ]);

    if (!viewerContext.canViewRoster) {
        redirect(`/dashboard/${guildId}`);
    }

    if (!profileResult.success || !profileResult.data) {
        notFound();
    }

    const profile = profileResult.data;

    const stats = {
        xp: profile.xp || 0,
        weeklyXp: profile.weeklyXp || 0,
        guildatons: 0,
        missionsValidated: profile.validatedMissionsCount || 0,
        weeklyMissions: profile.weeklyMissions || 0,
        joinedAt: profile.discordInfo?.joinedAt ? new Date(profile.discordInfo.joinedAt) : null,
        lastActivity: profile.lastActivityAt
            ? { description: "Activité", date: new Date(profile.lastActivityAt) }
            : null,
        isTopContributor: (profile.xp || 0) >= 1000,
        weeklyActivity: [] as { week: string; submissions: number; validated: number }[],
        missionsByCategory: [] as { category: string; count: number; validated: number }[],
        totalGuildMissions: profile.totalGuildMissions || 0,
    };

    const roleColor = profile.discordInfo?.roleColor || 0;
    const discordNickname = profile.discordInfo?.nickname || null;
    const displayName = getDisplayName(profile);

    const now = new Date();
    const vacationStart = profile.vacationStart ? new Date(profile.vacationStart) : null;
    const vacationEnd = profile.vacationEnd ? new Date(profile.vacationEnd) : null;
    const isOnVacation = !!(vacationStart && vacationStart <= now && (!vacationEnd || vacationEnd >= now));

    const isOnline = !!(profile.lastActivityAt && (now.getTime() - new Date(profile.lastActivityAt).getTime() < 2 * 60 * 1000));

    return (
        <div className="p-6 space-y-6">
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

            <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border border-white/5 rounded-lg">
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                    <div className="w-1 h-1 rounded-full bg-zinc-600" />
                    Dernière mise à jour du profil
                </div>
                <div className="text-[10px] font-bold text-zinc-400">
                    {profile.updatedAt ? format(new Date(profile.updatedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr }) : "Inconnue"}
                </div>
            </div>

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

                {session.user.id !== profile.userId && (
                    <SolicitAction
                        targetUserId={profile.userId}
                        targetName={displayName}
                        guildId={guildId}
                        capabilities={{
                            jobs: (profile.metiers as string[]) || [],
                            alignment: profile.alignment,
                            alignmentOrder: profile.alignmentOrder,
                            legendaryCrafts: profile.legendaryCrafts || []
                        }}
                    />
                )}
            </div>

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
                    altPseudos: (profile.altPseudos as string[]) || [],
                    metamobPseudo: profile.metamobPseudo,
                    metamobVerified: profile.metamobVerified,
                    metamobLastSync: profile.metamobLastSync ? new Date(profile.metamobLastSync) : null,
                    dofusBookLinks: (profile.dofusBookLinks as any) || [],
                    introduction: profile.introduction,
                    notificationPrefs: profile.notificationPrefs as any,
                    successPoints: profile.successPoints,
                    lastLadderUpdate: profile.lastLadderUpdate ? new Date(profile.lastLadderUpdate) : null,
                    roleGrants: profile.roleGrants || [],
                    alignment: profile.alignment,
                    alignmentOrder: profile.alignmentOrder,
                    alignmentLevel: profile.alignmentLevel,
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
                welcomeBadgeName={guildData.welcomeBadgeName}
                readOnly={true}
                isSuperAdmin={viewerContext.isSuperAdmin}
                isAdmin={profile.discordInfo?.isAdmin || false}
                permissions={{
                    canViewOcre: viewerContext.canViewOcre,
                    canViewSonges: viewerContext.canViewSonges,
                    canViewLadder: viewerContext.canViewLadder,
                    canManualSyncLadder: viewerContext.canManualSyncLadder,
                    canViewMissions: viewerContext.canViewMissions,
                }}
            />

            {viewerContext.canViewOcre && (
                <ArchiMatchingWidget
                    guildId={guildId}
                    profileId={profile.id}
                    ownerDisplayName={displayName}
                />
            )}
        </div>
    );
}
