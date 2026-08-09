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
import { PresentationCard } from "./presentation-card";
import { ProfileDofusTab } from "./profile-dofus-tab";
import { ProfileServicesTab } from "./profile-services-tab";
import { ProfileActivityTab } from "./profile-activity-tab";
import { SkinLibrary } from "./skin-library";
import { AlignmentSection } from "./alignment-section";
import { LegendaryCrafting } from "./legendary-crafting";
import { LegendaryPetToggle } from "./legendary-pet-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateUserProfile, updateAvailability, updateVacationMode, updateForgemagieStatus, updateAltPseudos } from "@/server/actions/profile-actions";
import type { ContributorTier } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { UserCircle, LayoutDashboard, Shield, Sparkles, Users, Calendar, Trophy, Settings, Hammer, Wrench, Activity } from "lucide-react";
import { ProfileReminderBanner } from "./profile-reminder-banner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { AvailabilityMap, ForgemagieStatusId, GlobalAvailability } from "@/lib/dofus-assets";
import { useTour } from "@/components/tour/tour-provider";

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
        vacationReason?: string | null;
        metamobPseudo?: string | null;
        metamobVerified?: boolean;
        metamobLastSync?: Date | null;
        altPseudos?: string[] | null;
        dofusBookLinks?: { id: string; url: string; name: string; tags?: string[]; classId?: number; createdAt?: string | null; updatedAt?: string | null; previewData?: any }[] | null;
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
        roleGrants?: any[];
        introduction?: string | null;
        objectifs?: string | null;
        preferredActivities?: string[] | null;
        discordContact?: string | null;
        activeServices?: any[];
        lastSeen?: string | Date | null;
        lastActivityAt?: string | Date | null;
        showPresence?: boolean;
        skins?: any[];
        alignment?: string | null;
        alignmentOrder?: string | null;
        alignmentLevel?: number | null;
        hasLegendaryPet?: boolean | null;
    };
    user: {
        name?: string | null;
        image?: string | null;
    };
    stats: {
        xp: number;
        weeklyXp: number;
        guildatons: number;
        missionsValidated: number;
        weeklyMissions: number;
        joinedAt: string | Date | null;
        lastActivity: { description: string; date: string | Date } | null;
        isTopContributor: boolean;
        contributorTier?: ContributorTier;
        rank?: number;
        weeklyActivity: { week: string; submissions: number; validated: number }[];
        missionsByCategory: { category: string; count: number; validated: number }[];
        totalGuildMissions: number;
        discordStats?: {
            weekly: { messages: number; voice: number };
            monthly: { messages: number; voice: number };
            total: { messages: number; voice: number };
        };
    };
    guildId: string;
    discordNickname?: string | null;
    readOnly?: boolean;
    isAdmin?: boolean;
    permissions?: {
        canViewOcre?: boolean;
        canViewSonges?: boolean;
        canViewLadder?: boolean;
        canSyncLadder?: boolean;
        canManualSyncLadder?: boolean;
        canViewMissions?: boolean;
        missionVitrineMode?: boolean;
    };
    guildName?: string;
    dofusServerId?: string | null;
    roleName?: string;
    roleColor?: number;
    welcomeBadgeName?: string | null;
    isSuperAdmin?: boolean;
    hasAbsenceChannel?: boolean;
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
    hasAbsenceChannel = false,
}: ProfileBentoGridProps) {
    const [localProfile, setLocalProfile] = useState(profile);
    const searchParams = useSearchParams();
    const initialTab = searchParams.get("tab") || "overview";
    const [activeTab, setActiveTab] = useState(initialTab);

    const { tourPhase, currentStep } = useTour();

    // Synchronize activeTab with onboarding tour phase & step
    useEffect(() => {
        if (tourPhase === "profile") {
            if (currentStep === 4) setActiveTab("metiers");
            else if (currentStep === 5) setActiveTab("planning");
            else if (currentStep === 6) setActiveTab("combat");
            else if (currentStep === 7) setActiveTab("dofus");
            else if (currentStep === 8) setActiveTab("activity");
            else if (currentStep === 9) setActiveTab("settings");
            else if (currentStep >= 1 && currentStep <= 3) setActiveTab("overview");
        }
    }, [currentStep, tourPhase]);

    // Default permissions to true if not provided (internal consistency)
    const { 
        canViewOcre = true, 
        canViewSonges = true, 
        canViewLadder = true, 
        canViewMissions = true,
        canSyncLadder = false,
        canManualSyncLadder = true,
        missionVitrineMode = false,
    } = permissions;

    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set([initialTab]));

    useEffect(() => {
        setVisitedTabs(prev => {
            if (prev.has(activeTab)) return prev;
            return new Set(prev).add(activeTab);
        });
    }, [activeTab]);

    // Sync state if URL param changes (optional but good for UX)
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const displayName = discordNickname || profile.pseudoDofus || "Voyageur";

    const isVitrineActive = missionVitrineMode && !isAdmin;

    // Compute empty section flags for readOnly mode (hide tabs/sections that have no data)
    const isEmpty: Record<string, boolean> = {
        activity: !canViewMissions || isVitrineActive,
        combat: readOnly && (!localProfile.dofusBookLinks || localProfile.dofusBookLinks.length === 0),
        skins: readOnly && (!localProfile.skins || localProfile.skins.length === 0),
        mules: readOnly && (!localProfile.altPseudos || localProfile.altPseudos.length === 0),
        achievements: readOnly && !localProfile.successPoints,
        metiers: readOnly && (!localProfile.metiers || localProfile.metiers.length === 0),
        artisanat: readOnly && (!localProfile.metiers || localProfile.metiers.length === 0) && !localProfile.hasLegendaryPet,
        planning: readOnly && (
            (!localProfile.availability || Object.keys(localProfile.availability).length === 0) &&
            !localProfile.vacationStart &&
            !localProfile.vacationEnd
        ),
        metamob: readOnly && !localProfile.metamobPseudo,
        alignment: readOnly && (!localProfile.alignment || localProfile.alignment === "neutre") && !localProfile.alignmentOrder,
    };

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
    const handleClassSave = async (mainClass: string, pseudo: string) => {
        setLocalProfile(prev => ({
            ...prev,
            classe: mainClass,
            pseudoDofus: pseudo
        }));

        const res = await updateUserProfile({
            guildId,
            classe: mainClass,
            // classeSecondaires: [], // Reset/Clear secondary classes
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

    const handleVacationSave = async (data: { start: Date | null; end: Date | null; notify: boolean; noEndDate: boolean; reason: string | null }) => {
        setLocalProfile(prev => ({
            ...prev,
            vacationStart: data.start,
            vacationEnd: data.noEndDate ? null : data.end,
            vacationNotify: data.notify,
            vacationReason: data.reason,
        }));
        const res = await updateVacationMode({
            guildId,
            vacationStart: data.start?.toISOString() ?? null,
            vacationEnd: data.noEndDate ? null : (data.end?.toISOString() ?? null),
            vacationNotify: data.notify,
            vacationReason: data.reason ?? null,
            targetUserId
        });
        if (res.success) {
            toast.success("Mode vacances mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleAltPseudosSave = async (altPseudos: any[]) => {
        const res = await updateAltPseudos({ guildId, altPseudos, targetUserId });
        if (res.success) {
            setLocalProfile(prev => ({ ...prev, altPseudos }));
        } else {
            toast.error(res.error || "Erreur lors de la sauvegarde");
            throw new Error(res.error); // Allow component to handle error
        }
    };

    const handlePresenceToggle = async (enabled: boolean) => {
        setLocalProfile(prev => ({ ...prev, showPresence: enabled }));
        const res = await updateUserProfile({ guildId, showPresence: enabled, targetUserId });
        if (res.success) {
            toast.success(enabled ? "Visibilité de l'activité activée" : "Visibilité de l'activité désactivée");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleAlignmentSave = async (data: { alignment: string | null; alignmentOrder: string | null; alignmentLevel: number }) => {
        setLocalProfile(prev => ({
            ...prev,
            alignment: data.alignment,
            alignmentOrder: data.alignmentOrder,
            alignmentLevel: data.alignmentLevel
        }));

        const res = await updateUserProfile({
            guildId,
            alignment: data.alignment,
            alignmentOrder: data.alignmentOrder,
            alignmentLevel: data.alignmentLevel,
            targetUserId
        });

        if (res.success) {
            toast.success("Alignement mis à jour");
        } else {
            toast.error(res.error || "Erreur lors de la sauvegarde");
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
            {/* Monthly Profile Reminder — only for profile owner */}
            {!readOnly && (
                <ProfileReminderBanner guildId={guildId} onSelectTab={setActiveTab} />
            )}

            {/* Hero Header (Glass) */}
            <div data-tour="profile-header" className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 backdrop-blur-md">
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
                    canViewMissions={permissions.canViewMissions}
                    canViewLadder={canViewLadder}
                    guildName={guildName}
                    sigilRoles={localProfile.roleGrants || []}
                    discordRoleName={roleName}
                    discordRoleColor={roleColor}
                    welcomeBadgeName={welcomeBadgeName}
                    shareSlug={encodeURIComponent(localProfile.pseudoDofus || profile.id)}
                    guildId={guildId}
                    readOnly={readOnly}
                />
            </div>

            {/* Sigma 2026 Sleek Glass Navigation Bar (Horizontal Figma 2026 UX) */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <div className="sticky top-20 z-30 w-full bg-zinc-950/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl overflow-x-auto scrollbar-width-none [&::-webkit-scrollbar]:hidden">
                    <TabsList className="bg-transparent flex flex-row items-center gap-1.5 h-auto justify-start border-none w-max">
                        {(() => {
                            const hasServices = !readOnly || ((localProfile as any).activeServices && (localProfile as any).activeServices.length > 0);
                            const ALL_TABS = [
                                { id: "overview", label: "Général", icon: UserCircle, activeColor: "text-emerald-400", bgActive: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]" },
                                { id: "intro", label: "Présentation", icon: LayoutDashboard, activeColor: "text-sky-400", bgActive: "bg-sky-500/15 border-sky-500/30 text-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.2)]" },
                                { id: "dofus", label: "Quêtes Dofus", icon: Sparkles, activeColor: "text-amber-400", bgActive: "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]" },
                                { id: "combat", label: "Stuffs", icon: Shield, activeColor: "text-rose-400", bgActive: "bg-rose-500/15 border-rose-500/30 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]" },
                                { id: "skins", label: "Skins", icon: Sparkles, activeColor: "text-pink-400", bgActive: "bg-pink-500/15 border-pink-500/30 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.2)]" },
                                { id: "mules", label: "Mules", icon: Users, activeColor: "text-indigo-400", bgActive: "bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]" },
                                { id: "achievements", label: "Succès", icon: Trophy, activeColor: "text-amber-400", bgActive: "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]" },
                                { id: "metiers", label: "Métiers", icon: Hammer, activeColor: "text-orange-400", bgActive: "bg-orange-500/15 border-orange-500/30 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.2)]" },
                                { id: "artisanat", label: "Légendaire", icon: Sparkles, activeColor: "text-fuchsia-400", bgActive: "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300 shadow-[0_0_15px_rgba(217,70,239,0.2)]" },
                                { id: "activity", label: "Présence & Feed", icon: Activity, activeColor: "text-indigo-400", bgActive: "bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]" },
                                { id: "planning", label: "Planning", icon: Calendar, activeColor: "text-cyan-400", bgActive: "bg-cyan-500/15 border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]" },
                                ...(hasServices ? [{ id: "services", label: "Services Proposés", icon: Wrench, activeColor: "text-orange-400", bgActive: "bg-orange-500/15 border-orange-500/30 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.2)]" }] : []),
                                ...(canEdit ? [{ id: "settings", label: "Réglages", icon: Settings, activeColor: "text-zinc-200", bgActive: "bg-white/15 border-white/30 text-white" }] : []),
                            ].filter(t => !isEmpty[t.id]);

                            return ALL_TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <TabsTrigger
                                        key={tab.id}
                                        value={tab.id}
                                        data-tour={`profile-tab-${tab.id}`}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer shrink-0",
                                            isActive
                                                ? cn("scale-[1.02]", tab.bgActive)
                                                : "bg-black/40 border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <tab.icon className={cn("w-3.5 h-3.5", isActive ? tab.activeColor : "text-zinc-500")} />
                                        <span>{tab.label}</span>
                                    </TabsTrigger>
                                );
                            });
                        })()}
                    </TabsList>
                </div>

                {/* Main Content Area (Full Width) */}
                <div className="min-w-0 space-y-8">
                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div id="profile-edit-section" className="flex flex-col gap-6">
                        {/* Classes */}
                        <div data-tour="profile-class">
                            <ClassDisplay
                                pseudoDofus={localProfile.pseudoDofus}
                                mainClass={localProfile.classe}
                                onSave={handleClassSave}
                                readOnly={!canEdit}
                                guildId={guildId}
                            />
                        </div>

                        {/* Metamob */}
                        {canViewOcre && !isEmpty.metamob && (
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

                        {/* Alignment & Order */}
                        {!isEmpty.alignment && (
                            <AlignmentSection
                                alignment={localProfile.alignment}
                                alignmentOrder={localProfile.alignmentOrder}
                                alignmentLevel={localProfile.alignmentLevel}
                                onSave={handleAlignmentSave}
                                readOnly={!canEdit}
                            />
                        )}
                    </div>
                </TabsContent>

                {/* INTRODUCTION / PRESENTATION TAB */}
                <TabsContent value="intro" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("intro") && (
                        <PresentationCard
                            introduction={localProfile.introduction || ""}
                            objectifs={localProfile.objectifs || ""}
                            preferredActivities={localProfile.preferredActivities || []}
                            discordContact={localProfile.discordContact || ""}
                            onSave={(data) => setLocalProfile(prev => ({
                                ...prev,
                                introduction: data.introduction,
                                objectifs: data.objectifs,
                                preferredActivities: data.preferredActivities,
                                discordContact: data.discordContact,
                            }))}
                            readOnly={!canEdit}
                            guildId={guildId}
                            displayName={displayName}
                            targetUserId={targetUserId}
                        />
                    )}
                </TabsContent>

                {/* DOFUS PROGRESSION TAB */}
                <TabsContent value="dofus" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("dofus") && (
                        <ProfileDofusTab
                            guildId={guildId}
                            profileId={localProfile.id}
                            readOnly={!canEdit}
                        />
                    )}
                </TabsContent>

                {/* SERVICES TAB */}
                <TabsContent value="services" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("services") && (
                        <ProfileServicesTab
                            guildId={guildId}
                            activeServices={(localProfile as any).activeServices || []}
                            readOnly={!canEdit}
                        />
                    )}
                </TabsContent>

                {/* ACTIVITY & PRESENCE TAB */}
                <TabsContent value="activity" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("activity") && (
                        <ProfileActivityTab
                            lastSeen={(localProfile as any).lastSeen || (localProfile as any).lastActivityAt}
                            lastActivityAt={localProfile.lastActivityAt}
                            xp={stats.xp}
                            contributionPoints={(localProfile as any).contributionPoints || 0}
                            validatedMissionsCount={stats.missionsValidated}
                            weeklyMissions={stats.weeklyMissions}
                            weeklyXp={stats.weeklyXp}
                            displayName={displayName}
                            canViewMissions={canViewMissions}
                        />
                    )}
                </TabsContent>

                {/* COMBAT TAB (Stuffs) */}
                <TabsContent value="combat" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("combat") && (
                        <div className="w-full">
                            <BuildsCard
                                links={localProfile.dofusBookLinks as any || []}
                                onSave={(links) => setLocalProfile(prev => ({ ...prev, dofusBookLinks: links }))}
                                readOnly={!canEdit}
                                guildId={guildId}
                                targetUserId={targetUserId}
                            />
                        </div>
                    )}
                </TabsContent>

                {/* SKINS TAB */}
                <TabsContent value="skins" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("skins") && (
                        <div className="w-full">
                            <SkinLibrary 
                                initialSkins={localProfile.skins || []}
                                guildId={guildId}
                                readOnly={!canEdit}
                                profileId={localProfile.id}
                            />
                        </div>
                    )}
                </TabsContent>

                {/* MULES TAB */}
                <TabsContent value="mules" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("mules") && (
                        <div className="w-full">
                            <AltPseudos
                                altPseudos={localProfile.altPseudos as any || []}
                                onSave={handleAltPseudosSave}
                                readOnly={!canEdit}
                                guildId={guildId}
                            />
                        </div>
                    )}
                </TabsContent>

                {/* PLANNING TAB */}
                <TabsContent value="planning" className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
                    {visitedTabs.has("planning") && (
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
                                    vacationReason={localProfile.vacationReason}
                                    onSave={handleVacationSave}
                                    readOnly={!canEdit}
                                    guildId={guildId}
                                    pseudo={displayName}
                                    profileId={profile.id}
                                    hasAbsenceChannel={hasAbsenceChannel}
                                />
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ACHIEVEMENTS TAB */}
                <TabsContent value="achievements" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("achievements") && (
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
                                    lastLadderUpdate: new Date()
                                }));
                            }}
                            canSyncLadder={canSyncLadder}
                        />
                    )}
                </TabsContent>

                 {/* MÉTIERS TAB */}
                 <TabsContent value="metiers" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                     {visitedTabs.has("metiers") && (
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
                     )}
                 </TabsContent>

                 {/* ARTISANAT TAB */}
                 <TabsContent value="artisanat" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                     {visitedTabs.has("artisanat") && (
                         <div className="space-y-12">
                             <LegendaryCrafting 
                                 guildId={guildId}
                                 profileId={localProfile.id}
                                 metiers={localProfile.metiers || []}
                                 readOnly={!canEdit}
                             />
                             <div className="border-t border-white/5 pt-8">
                                 <LegendaryPetToggle
                                     guildId={guildId}
                                     initialValue={localProfile.hasLegendaryPet ?? false}
                                     readOnly={!canEdit}
                                 />
                             </div>
                         </div>
                     )}
                 </TabsContent>



                {/* SETTINGS TAB */}
                {canEdit && (
                    <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {visitedTabs.has("settings") && (
                            <UserSettings
                                guildId={guildId}
                                guildName={guildName || "la guilde"}
                                profileId={profile.id}
                                notificationPrefs={localProfile.notificationPrefs as any}
                                onNotificationPrefsSave={handleNotificationPrefsSave}
                                showPresence={localProfile.showPresence ?? true}
                                onPresenceToggle={handlePresenceToggle}
                                isAdmin={isAdmin}
                                targetUserId={targetUserId}
                            />
                        )}
                    </TabsContent>
                )}
                </div>
            </Tabs>
        </div>
    );
}
