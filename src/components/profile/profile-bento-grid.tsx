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
import { MemberStats } from "./member-stats";
import { SkinLibrary } from "./skin-library";
import { AlignmentSection } from "./alignment-section";
import { LegendaryCrafting } from "./legendary-crafting";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateUserProfile, updateAvailability, updateVacationMode, updateForgemagieStatus, updateAltPseudos } from "@/server/actions/profile-actions";
import type { ContributorTier } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { UserCircle, LayoutDashboard, Shield, Sparkles, Users, Calendar, Trophy, BarChart3, Settings, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
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
        vacationReason?: string | null;
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
        roleGrants?: any[];
        introduction?: string | null;
        showPresence?: boolean;
        skins?: any[];
        alignment?: string | null;
        alignmentOrder?: string | null;
        alignmentLevel?: number | null;
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

    // Default permissions to true if not provided (internal consistency)
    const { 
        canViewOcre = true, 
        canViewSonges = true, 
        canViewLadder = true, 
        canViewMissions = true,
        canSyncLadder = false,
        canManualSyncLadder = true
    } = permissions;

    // Sync state if URL param changes (optional but good for UX)
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set([initialTab]));

    useEffect(() => {
        setVisitedTabs(prev => {
            if (prev.has(activeTab)) return prev;
            return new Set(prev).add(activeTab);
        });
    }, [activeTab]);

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

            {/* Sigma 2026 Adaptive Layout */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="grid lg:grid-cols-[280px_1fr] grid-cols-1 gap-8 items-start">
                
                {/* Sidebar Navigation (Sticky on Desktop, Scrollable on Mobile) */}
                <aside className="lg:sticky lg:top-24 z-20 min-w-0 w-full">
                    <TabsList className="bg-transparent flex lg:flex-col flex-row flex-nowrap overflow-x-auto lg:overflow-visible gap-2 p-1 h-auto justify-start border-none w-full scrollbar-width-none [&::-webkit-scrollbar]:hidden">
                        {(() => {
                            const TABS_GROUPS = [
                                {
                                    name: "Identité",
                                    tabs: [
                                        { id: "overview", label: "Général", icon: UserCircle, activeColor: "text-emerald-400", bgActive: "bg-emerald-500/10", indicator: "bg-emerald-500 shadow-emerald-500/50" },
                                        { id: "intro", label: "Présentation", icon: LayoutDashboard, activeColor: "text-sky-400", bgActive: "bg-sky-500/10", indicator: "bg-sky-500 shadow-sky-500/50" },
                                    ]
                                },
                                {
                                    name: "Jeu & Progression",
                                    tabs: [
                                        { id: "combat", label: "Stuffs", icon: Shield, activeColor: "text-rose-400", bgActive: "bg-rose-500/10", indicator: "bg-rose-500 shadow-rose-500/50" },
                                        { id: "skins", label: "Skins", icon: Sparkles, activeColor: "text-pink-400", bgActive: "bg-pink-500/10", indicator: "bg-pink-500 shadow-pink-500/50" },
                                        { id: "mules", icon: Users, label: "Mules", activeColor: "text-indigo-400", bgActive: "bg-indigo-500/10", indicator: "bg-indigo-500 shadow-indigo-500/50" },
                                        { id: "achievements", label: "Succès", icon: Trophy, activeColor: "text-amber-400", bgActive: "bg-amber-500/10", indicator: "bg-amber-500 shadow-amber-500/50" },
                                    ]
                                },
                                {
                                    name: "Artisanat",
                                    tabs: [
                                        { id: "metiers", label: "Métiers", icon: Hammer, activeColor: "text-orange-400", bgActive: "bg-orange-500/10", indicator: "bg-orange-500 shadow-orange-500/50" },
                                        { id: "artisanat", label: "Légendaire", icon: Sparkles, activeColor: "text-fuchsia-400", bgActive: "bg-fuchsia-500/10", indicator: "bg-fuchsia-500 shadow-fuchsia-500/50" },
                                    ]
                                },
                                {
                                    name: "Activité",
                                    tabs: [
                                        { id: "planning", label: "Planning", icon: Calendar, activeColor: "text-cyan-400", bgActive: "bg-cyan-500/10", indicator: "bg-cyan-500 shadow-cyan-500/50" },
                                        { id: "stats", label: "Statistiques", icon: BarChart3, activeColor: "text-blue-400", bgActive: "bg-blue-500/10", indicator: "bg-blue-500 shadow-blue-500/50" },
                                    ]
                                },
                                ...(canEdit ? [{
                                    name: "Administration",
                                    tabs: [
                                        { id: "settings", label: "Réglages", icon: Settings, activeColor: "text-zinc-200", bgActive: "bg-white/10", indicator: "bg-white shadow-white/50" }
                                    ]
                                }] : [])
                            ];

                            return TABS_GROUPS.map((group, gIdx) => (
                                <div key={group.name} className={cn("flex flex-col gap-1 w-full", gIdx > 0 && "mt-4 lg:mt-6")}>
                                    <h4 className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2 px-4">
                                        {group.name}
                                    </h4>
                                    {group.tabs.map((tab) => (
                                        <TabsTrigger
                                            key={tab.id}
                                            value={tab.id}
                                            className={cn(
                                                "relative flex items-center justify-start gap-3 min-w-[max-content] lg:w-full px-4 py-3 rounded-2xl transition-all duration-300 group shrink-0 overflow-hidden",
                                                "bg-zinc-900/40 backdrop-blur-md border border-white/5",
                                                "data-[state=active]:border-white/10 data-[state=active]:shadow-lg",
                                                activeTab === tab.id ? tab.bgActive : "hover:bg-white/[0.07] hover:border-white/10 active:scale-[0.98]"
                                            )}
                                        >
                                            {/* Hover Glow (Pre-click highlight) */}
                                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                            <div className={cn(
                                                "p-2 rounded-xl transition-all duration-500 z-10",
                                                "bg-zinc-800/50 group-data-[state=active]:scale-110 group-data-[state=active]:translate-x-1 group-data-[state=active]:bg-zinc-950/50",
                                                activeTab === tab.id ? `${tab.activeColor} shadow-[0_0_15px_rgba(0,0,0,0.3)]` : "text-zinc-500 group-hover:text-zinc-300"
                                            )}>
                                                <tab.icon className="w-4 h-4" />
                                            </div>
                                            
                                            <span className={cn(
                                                "text-sm font-black uppercase tracking-widest transition-all duration-300 z-10",
                                                activeTab === tab.id ? "text-white translate-x-1" : "text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5"
                                            )}>
                                                {tab.label}
                                            </span>

                                            {/* Neon Indicator */}
                                            {activeTab === tab.id && (
                                                <div className={cn(
                                                    "absolute left-0 w-1 h-6 rounded-full z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                                                    tab.indicator
                                                )} />
                                            )}
                                        </TabsTrigger>
                                    ))}
                                </div>
                            ));
                        })()}
                    </TabsList>
                </aside>

                {/* Main Content Area */}
                <div className="min-w-0 space-y-8">

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-6">
                        {/* Classes */}
                        <ClassDisplay
                            pseudoDofus={localProfile.pseudoDofus}
                            mainClass={localProfile.classe}
                            onSave={handleClassSave}
                            readOnly={!canEdit}
                            guildId={guildId}
                        />

                        {/* Metamob */}
                        {canViewOcre && (
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
                        <AlignmentSection
                            alignment={localProfile.alignment}
                            alignmentOrder={localProfile.alignmentOrder}
                            alignmentLevel={localProfile.alignmentLevel}
                            onSave={handleAlignmentSave}
                            readOnly={!canEdit}
                        />
                    </div>
                </TabsContent>

                {/* INTRODUCTION TAB */}
                <TabsContent value="intro" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("intro") && (
                        <IntroductionCard
                            introduction={localProfile.introduction || ""}
                            onSave={(text: string) => setLocalProfile(prev => ({ ...prev, introduction: text }))}
                            readOnly={!canEdit}
                            guildId={guildId}
                            displayName={displayName}
                            targetUserId={targetUserId}
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
                         <LegendaryCrafting 
                             guildId={guildId}
                             profileId={localProfile.id}
                             metiers={localProfile.metiers || []}
                             readOnly={!canEdit}
                         />
                     )}
                 </TabsContent>

                 {/* STATS TAB */}
                <TabsContent value="stats" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visitedTabs.has("stats") && (
                        <MemberStats stats={stats} />
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
            </div>
            </Tabs>
        </div>
    );
}
