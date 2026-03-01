"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { HeroHeader } from "./hero-header";
import { ClassDisplay } from "./class-display";
import { JobsGrid } from "./jobs-grid";
import { AvailabilityHeatmap } from "./availability-heatmap";
import { VacationMode } from "./vacation-mode";
import { MetamobLink } from "./metamob-link";
import { AltPseudos } from "./alt-pseudos";
import { BuildsCard } from "./builds-card";
import { SuccessSync } from "./success-sync";
import { UserSettings } from "./user-settings";
import { IntroductionCard } from "./introduction-card";
import { DreamRunHistory } from "./dream-run-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateUserProfile, updateAvailability, updateVacationMode, updateForgemagieStatus, updateAltPseudos, type ContributorTier } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import type { AvailabilityMap, ForgemagieStatusId, GlobalAvailability } from "@/lib/dofus-assets";

interface ProfileBentoGridProps {
    profile: {
        id: string;
        userId?: string;
        pseudoDofus?: string | null;
        classe?: string | null;
        classeSecondaires?: string[] | null;
        metiers?: string[] | null;
        forgemagieStatus?: string | null;
        fmPriceClassic?: number | null;
        fmPriceTrans?: number | null;
        fmPriceExo?: number | null;
        availability?: GlobalAvailability | AvailabilityMap | null;
        vacationStart?: Date | null;
        vacationEnd?: Date | null;
        vacationNotify?: boolean;
        metamobPseudo?: string | null;
        metamobVerified?: boolean;
        metamobLastSync?: Date | null;
        altPseudos?: string[] | null;
        dofusBookLinks?: { id: string; url: string; name: string }[] | null;
        successPoints?: number | null;
        lastLadderUpdate?: Date | null;
        notificationPrefs?: {
            missions?: boolean;
            songes?: boolean;
            events?: boolean;
            ladder?: boolean;
            polls?: boolean;
            admin_validations?: boolean;
        } | null;
        pendingSubmission?: {
            id: string;
            points: number;
            ocrScore: number;
            createdAt: Date;
        } | null;
        roleGrants?: any[];
        introduction?: string | null;
    };
    user: {
        name?: string | null;
        image?: string | null;
    };
    stats: {
        xp: number;
        weeklyXp: number;
        missionsValidated: number;
        weeklyMissions: number;
        joinedAt: string | Date | null;
        lastActivity: { description: string; date: string | Date } | null;
        isTopContributor: boolean;
        contributorTier?: ContributorTier;
        rank?: number;
    };
    guildId: string;
    discordNickname?: string | null;
    readOnly?: boolean;
    isAdmin?: boolean;
    permissions?: {
        canViewArchis?: boolean;
        canViewSonges?: boolean;
        canViewLadder?: boolean;
        canViewMissions?: boolean;
    };
    guildName?: string;
    dofusServerId?: string | null;
    roleName?: string;
    roleColor?: number;
    welcomeBadgeName?: string | null;
    isSuperAdmin?: boolean;
}

export function ProfileBentoGrid({
    profile,
    user,
    stats,
    guildId,
    discordNickname,
    readOnly = false,
    isAdmin = false,
    permissions = {},
    guildName,
    dofusServerId,
    roleName = "Membre",
    roleColor = 0,
    welcomeBadgeName,
    isSuperAdmin = false,
}: ProfileBentoGridProps) {
    const [localProfile, setLocalProfile] = useState(profile);
    const searchParams = useSearchParams();
    const initialTab = searchParams.get("tab") || "overview";
    const [activeTab, setActiveTab] = useState(initialTab);

    // Default permissions to true if not provided (internal consistency)
    const { canViewArchis = true, canViewSonges = true, canViewLadder = true, canViewMissions = true } = permissions;

    // Sync state if URL param changes (optional but good for UX)
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    const displayName = discordNickname || profile.pseudoDofus || user.name || "Voyageur";

    const now = new Date();
    const startDate = localProfile.vacationStart ? new Date(localProfile.vacationStart) : null;
    const endDate = localProfile.vacationEnd ? new Date(localProfile.vacationEnd) : null;

    const isUpcoming = Boolean(startDate && startDate > now);
    const isOnVacation = Boolean(startDate && startDate <= now && (!endDate || endDate >= now));

    // canEdit logic: Normal users can only edit if NOT readOnly. 
    // SuperAdmins can ALWAYS edit (God Mode).
    const canEdit = !readOnly || isSuperAdmin;
    const targetUserId = isSuperAdmin ? profile.userId : undefined;

    // Handlers
    const handleClassSave = async (mainClass: string, secondaryClasses: string[], pseudo: string) => {
        setLocalProfile(prev => ({
            ...prev,
            classe: mainClass,
            classeSecondaires: secondaryClasses,
            pseudoDofus: pseudo
        }));

        const res = await updateUserProfile({
            guildId,
            classe: mainClass,
            classeSecondaires: secondaryClasses,
            pseudoDofus: pseudo,
            targetUserId
        });

        if (res.success) {
            toast.success("Profil mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleJobsSave = async (jobs: string[]) => {
        setLocalProfile(prev => ({ ...prev, metiers: jobs }));
        const res = await updateUserProfile({
            guildId,
            metiers: jobs,
            targetUserId
        });
        if (res.success) {
            toast.success("Métiers mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleForgemagieStatusSave = async (status: ForgemagieStatusId) => {
        setLocalProfile(prev => ({ ...prev, forgemagieStatus: status }));
        const res = await updateForgemagieStatus({ guildId, status, targetUserId });
        if (res.success) {
            toast.success("Statut Forgemagie mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleForgemagiePricesSave = async (prices: { classic: number | null, trans: number | null, exo: number | null }) => {
        setLocalProfile(prev => ({
            ...prev,
            fmPriceClassic: prices.classic,
            fmPriceTrans: prices.trans,
            fmPriceExo: prices.exo
        }));

        const res = await updateUserProfile({
            guildId,
            fmPriceClassic: prices.classic,
            fmPriceTrans: prices.trans,
            fmPriceExo: prices.exo,
            targetUserId
        });

        if (res.success) {
            toast.success("Tarifs Forgemagie mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleAvailabilitySave = async (availability: GlobalAvailability) => {
        setLocalProfile(prev => ({ ...prev, availability: availability as any }));
        const res = await updateAvailability({ guildId, availability, targetUserId });
        if (res.success) {
            toast.success("Disponibilités mises à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleVacationSave = async (data: { start: Date | null; end: Date | null; notify: boolean; noEndDate: boolean }) => {
        setLocalProfile(prev => ({
            ...prev,
            vacationStart: data.start,
            vacationEnd: data.noEndDate ? null : data.end,
            vacationNotify: data.notify,
        }));
        const res = await updateVacationMode({
            guildId,
            vacationStart: data.start?.toISOString() ?? null,
            vacationEnd: data.noEndDate ? null : (data.end?.toISOString() ?? null),
            vacationNotify: data.notify,
            targetUserId
        });
        if (res.success) {
            toast.success("Mode vacances mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleAltPseudosSave = async (altPseudos: string[]) => {
        const res = await updateAltPseudos({ guildId, altPseudos, targetUserId });
        if (res.success) {
            setLocalProfile(prev => ({ ...prev, altPseudos }));
        } else {
            toast.error(res.error || "Erreur lors de la sauvegarde");
            throw new Error(res.error); // Allow component to handle error
        }
    };

    const handleNotificationPrefsSave = (prefs: any) => {
        setLocalProfile(prev => ({
            ...prev,
            notificationPrefs: {
                ...(prev.notificationPrefs || {}),
                ...prefs
            }
        }));
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Hero Header (Glass) */}
            <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 backdrop-blur-md">
                <HeroHeader
                    avatarUrl={user.image}
                    displayName={displayName}
                    roleColor={roleColor}
                    contributorTier={stats.contributorTier}
                    rank={stats.rank}
                    isOnVacation={isOnVacation}
                    isUpcomingVacation={isUpcoming}
                    vacationStart={startDate}
                    vacationEnd={endDate}
                    joinedAt={stats.joinedAt}
                    xp={stats.xp}
                    weeklyXp={stats.weeklyXp}
                    missionsValidated={stats.missionsValidated}
                    weeklyMissions={stats.weeklyMissions}
                    canViewMissions={permissions.canViewMissions}
                    canViewLadder={canViewLadder}
                    guildName={guildName}
                    sigilRoles={localProfile.roleGrants || []}
                    discordRoleName={roleName}
                    discordRoleColor={roleColor}
                    welcomeBadgeName={welcomeBadgeName}
                />
            </div>

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-center mb-6">
                    <TabsList className="bg-zinc-900/60 backdrop-blur-md border border-white/10 p-1 h-11 rounded-full text-zinc-400">
                        <TabsTrigger
                            value="overview"
                            className="rounded-full px-6 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30 border border-transparent transition-all"
                        >
                            Général
                        </TabsTrigger>
                        <TabsTrigger
                            value="intro"
                            className="rounded-full px-6 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30 border border-transparent transition-all"
                        >
                            Ma Présentation
                        </TabsTrigger>
                        <TabsTrigger
                            value="combat"
                            className="rounded-full px-6 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 data-[state=active]:border-indigo-500/30 border border-transparent transition-all"
                        >
                            Stuffs et Autres Personnages
                        </TabsTrigger>
                        <TabsTrigger
                            value="planning"
                            className="rounded-full px-6 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 data-[state=active]:border-amber-500/30 border border-transparent transition-all"
                        >
                            Planning
                        </TabsTrigger>
                        {canViewLadder && (
                            <TabsTrigger
                                value="achievements"
                                className="rounded-full px-6 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 data-[state=active]:border-amber-500/30 border border-transparent transition-all"
                            >
                                Succès
                            </TabsTrigger>
                        )}
                        {canViewSonges && (
                            <TabsTrigger
                                value="songes"
                                className="rounded-full px-6 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/30 border border-transparent transition-all"
                            >
                                Songes
                            </TabsTrigger>
                        )}
                        {canEdit && (
                            <TabsTrigger
                                value="settings"
                                className="rounded-full px-6 data-[state=active]:bg-zinc-500/20 data-[state=active]:text-zinc-300 data-[state=active]:border-white/10 border border-transparent transition-all gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                Paramètres
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <div className="flex flex-col gap-6">
                            {/* Classes */}
                            <ClassDisplay
                                pseudoDofus={localProfile.pseudoDofus}
                                mainClass={localProfile.classe}
                                secondaryClasses={localProfile.classeSecondaires || []}
                                onSave={handleClassSave}
                                readOnly={!canEdit}
                            />

                            {/* Metamob */}
                            {canViewArchis && (
                                <MetamobLink
                                    guildId={guildId}
                                    metamobPseudo={profile.metamobPseudo}
                                    metamobVerified={profile.metamobVerified}
                                    metamobLastSync={profile.metamobLastSync}
                                    readOnly={!canEdit}
                                    isAdmin={isAdmin}
                                    targetUserId={targetUserId}
                                />
                            )}


                        </div>

                        {/* Jobs */}
                        {/* Jobs */}
                        <JobsGrid
                            jobs={localProfile.metiers || []}
                            forgemagieStatus={(localProfile.forgemagieStatus as ForgemagieStatusId) || "UNAVAILABLE"}
                            fmPriceClassic={localProfile.fmPriceClassic}
                            fmPriceTrans={localProfile.fmPriceTrans}
                            fmPriceExo={localProfile.fmPriceExo}
                            onSaveJobs={handleJobsSave}
                            onSaveForgemagieStatus={handleForgemagieStatusSave}
                            onSaveForgemagiePrices={handleForgemagiePricesSave}
                            readOnly={!canEdit}
                        />
                    </div>
                </TabsContent>

                {/* INTRODUCTION TAB */}
                <TabsContent value="intro" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <IntroductionCard
                        introduction={localProfile.introduction || ""}
                        onSave={(text: string) => setLocalProfile(prev => ({ ...prev, introduction: text }))}
                        readOnly={!canEdit}
                        guildId={guildId}
                        displayName={displayName}
                        targetUserId={targetUserId}
                    />
                </TabsContent>

                {/* COMBAT TAB */}
                <TabsContent value="combat" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* Builds */}
                        <BuildsCard
                            links={localProfile.dofusBookLinks as any || []}
                            onSave={(links) => setLocalProfile(prev => ({ ...prev, dofusBookLinks: links }))}
                            readOnly={!canEdit}
                            guildId={guildId}
                            targetUserId={targetUserId}
                        />

                        {/* Alt Pseudos */}
                        <AltPseudos
                            altPseudos={localProfile.altPseudos || []}
                            onSave={handleAltPseudosSave}
                            readOnly={!canEdit}
                        />
                    </div>
                </TabsContent>

                {/* PLANNING TAB */}
                <TabsContent value="planning" className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <AvailabilityHeatmap
                                availability={localProfile.availability || {}}
                                onSave={handleAvailabilitySave}
                                readOnly={!canEdit}
                                vacationStart={localProfile.vacationStart}
                                vacationEnd={localProfile.vacationEnd}
                            />
                        </div>
                        <div>
                            <VacationMode
                                vacationStart={localProfile.vacationStart}
                                vacationEnd={localProfile.vacationEnd}
                                vacationNotify={localProfile.vacationNotify}
                                onSave={handleVacationSave}
                                readOnly={!canEdit}
                                guildId={guildId}
                                pseudo={displayName}
                                profileId={profile.id}
                            />
                        </div>
                    </div>
                </TabsContent>
                {/* ACHIEVEMENTS TAB */}
                <TabsContent value="achievements" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <SuccessSync
                        pseudoDofus={localProfile.pseudoDofus}
                        guildId={guildId}
                        dofusServerId={dofusServerId}
                        successPoints={localProfile.successPoints}
                        lastUpdate={localProfile.lastLadderUpdate}
                        readOnly={!canEdit}
                        onTabChange={setActiveTab}
                        onSuccess={(points) => {
                            setLocalProfile(prev => ({
                                ...prev,
                                successPoints: points,
                                lastLadderUpdate: new Date(),
                                pendingSubmission: null // Clear on success
                            }));
                        }}
                        pendingSubmission={localProfile.pendingSubmission}
                        onCancel={() => {
                            setLocalProfile(prev => ({
                                ...prev,
                                pendingSubmission: null
                            }));
                        }}
                        targetUserId={targetUserId}
                    />
                </TabsContent>

                {/* SONGES TAB */}
                <TabsContent value="songes" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <DreamRunHistory guildId={guildId} userId={profile.userId} />
                </TabsContent>

                {/* SETTINGS TAB */}
                {canEdit && (
                    <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <UserSettings
                            guildId={guildId}
                            guildName={guildName || "la guilde"}
                            profileId={profile.id}
                            notificationPrefs={localProfile.notificationPrefs as any}
                            onNotificationPrefsSave={handleNotificationPrefsSave}
                            isAdmin={isAdmin}
                            targetUserId={targetUserId}
                        />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
