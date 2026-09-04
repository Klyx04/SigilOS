"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { BadgesVitrine } from "./badges-vitrine";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateUserProfile, updateAvailability, updateVacationMode, updateForgemagieStatus, updateAltPseudos } from "@/server/actions/profile-actions";
import type { ContributorTier } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { UserCircle, LayoutDashboard, Shield, Sparkles, Users, Calendar, Trophy, Settings, Hammer, Wrench, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProfileReminderBanner } from "./profile-reminder-banner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { AvailabilityMap, ForgemagieStatusId, GlobalAvailability } from "@/lib/dofus-assets";
import { metierIds, type MetierEntry } from "@/lib/metiers";
import { useTour } from "@/components/tour/tour-provider";

interface ProfileBentoGridProps {
    profile: {
        id: string;
        userId?: string;
        pseudoDofus?: string | null;
        classe?: string | null;
        classeSecondaires?: string[] | null;
        metiers?: string[] | MetierEntry[] | null;
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
    initialTab?: string;
    /** Module Disponibilités : masque l'onglet Planning (planning perso) quand inactif / sans RBAC. */
    canViewPlanning?: boolean;
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
    canViewPlanning = true,
    initialTab: initialTabProp,
}: ProfileBentoGridProps) {
    const [localProfile, setLocalProfile] = useState(profile);
    const searchParams = useSearchParams();
    const initialTab = initialTabProp || searchParams.get("tab") || "overview";
    const [activeTab, setActiveTab] = useState(initialTab);
    const tabsScrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = tabsScrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    useEffect(() => {
        const el = tabsScrollRef.current;
        if (!el) return;
        updateScrollState();
        el.addEventListener("scroll", updateScrollState, { passive: true });
        const ro = new ResizeObserver(updateScrollState);
        ro.observe(el);
        return () => {
            el.removeEventListener("scroll", updateScrollState);
            ro.disconnect();
        };
    }, [updateScrollState]);

    const scrollTabs = useCallback((dir: "left" | "right") => {
        const el = tabsScrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
    }, []);

    const { tourPhase, activeStepData } = useTour();

    // Synchronize activeTab with onboarding tour phase & active step target
    useEffect(() => {
        if (tourPhase === "profile" && activeStepData?.target) {
            const target = activeStepData.target;
            if (target.includes("metiers")) setActiveTab("metiers");
            else if (target.includes("planning")) setActiveTab("planning");
            else if (target.includes("combat")) setActiveTab("combat");
            else if (target.includes("dofus")) setActiveTab("dofus");
            else if (target.includes("activity")) setActiveTab("activity");
            else if (target.includes("settings")) setActiveTab("settings");
            else if (target.includes("profile-header") || target.includes("profile-class") || target.includes("overview")) setActiveTab("overview");
        }
    }, [activeStepData, tourPhase]);

    // Default permissions to true if not provided (internal consistency)
    const { 
        canViewOcre = true, 
        canViewSonges = true, 
        canViewLadder = true, 
        canViewMissions = true,
        canSyncLadder = false,
        // #137 — fail-closed : sans valeur fournie, la capture OCR (Manuel) reste masquée.
        canManualSyncLadder = false,
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

    // Module Disponibilités inactif → l'onglet planning est masqué : repousse vers overview
    useEffect(() => {
        if (!canViewPlanning && activeTab === "planning") {
            setActiveTab("overview");
        }
    }, [activeTab, canViewPlanning]);

    const displayName = discordNickname || profile.pseudoDofus || "Voyageur";

    const isVitrineActive = missionVitrineMode;

    // Si la vitrine est active, l'onglet "Présence & Feed" est masqué : on repousse
    // l'onglet actif vers "overview" s'il pointait vers un onglet désormais invisible
    // (évite un contenu affiché sans onglet visible, ex. via ?tab=activity dans l'URL).
    useEffect(() => {
        if (isVitrineActive && activeTab === "activity") {
            setActiveTab("overview");
        }
    }, [isVitrineActive, activeTab]);

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

    // canEdit logic: Édition autorisée uniquement sur son propre profil (readOnly === false).
    const canEdit = !readOnly;
    const targetUserId = undefined;

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

    const handleJobsSave = async (jobs: MetierEntry[]) => {
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
            <div data-tour="profile-header" className="rounded-3xl overflow-hidden border border-border shadow-2xl bg-muted/40 backdrop-blur-md">
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

            {/* Sigma 2026 Sleek Glass Navigation Bar */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <div className="sticky top-20 z-30 w-full min-w-0 relative">
                    {/* Scroll shadow + arrow — left */}
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pointer-events-none transition-opacity duration-200",
                        canScrollLeft ? "opacity-100" : "opacity-0"
                    )}>
                        <button
                            aria-label="Faire défiler vers la gauche"
                            onClick={() => scrollTabs("left")}
                            className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-xl bg-surface/90 border border-border/80 shadow-md text-muted-foreground hover:text-foreground hover:bg-elevated transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    </div>

                    <div
                        ref={tabsScrollRef}
                        className="w-full bg-surface/75 dark:bg-surface/80 backdrop-blur-2xl border border-border/80 p-1.5 rounded-2xl shadow-xl shadow-black/10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        <TabsList className="bg-transparent inline-flex flex-row items-center gap-1 h-auto justify-start border-none min-w-max p-0">
                        {(() => {
                            const hasServices = !readOnly || ((localProfile as any).activeServices && (localProfile as any).activeServices.length > 0);
                            const ALL_TABS = [
                                { id: "overview", label: "Général", icon: UserCircle, activeColor: "text-emerald-400", bgActive: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10" },
                                { id: "intro", label: "Présentation", icon: LayoutDashboard, activeColor: "text-sky-400", bgActive: "bg-sky-500/15 border-sky-500/30 text-sky-300 shadow-sm shadow-sky-500/10" },
                                { id: "dofus", label: "Quêtes Dofus", icon: Sparkles, activeColor: "text-amber-400", bgActive: "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10" },
                                { id: "combat", label: "Stuffs", icon: Shield, activeColor: "text-rose-400", bgActive: "bg-rose-500/15 border-rose-500/30 text-rose-300 shadow-sm shadow-rose-500/10" },
                                { id: "skins", label: "Skins", icon: Sparkles, activeColor: "text-pink-400", bgActive: "bg-pink-500/15 border-pink-500/30 text-pink-300 shadow-sm shadow-pink-500/10" },
                                { id: "mules", label: "Mules", icon: Users, activeColor: "text-cyan-400", bgActive: "bg-cyan-500/15 border-cyan-500/30 text-cyan-300 shadow-sm shadow-cyan-500/10" },
                                { id: "achievements", label: "Succès", icon: Trophy, activeColor: "text-yellow-400", bgActive: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300 shadow-sm shadow-yellow-500/10" },
                                { id: "metiers", label: "Métiers", icon: Hammer, activeColor: "text-amber-400", bgActive: "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10" },
                                { id: "artisanat", label: "Légendaire", icon: Sparkles, activeColor: "text-fuchsia-400", bgActive: "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300 shadow-sm shadow-fuchsia-500/10" },
                                { id: "activity", label: "Présence & Feed", icon: Activity, activeColor: "text-indigo-400", bgActive: "bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-sm shadow-indigo-500/10" },
                                ...(canViewPlanning ? [{ id: "planning", label: "Planning", icon: Calendar, activeColor: "text-blue-400", bgActive: "bg-blue-500/15 border-blue-500/30 text-blue-300 shadow-sm shadow-blue-500/10" }] : []),
                                ...(hasServices ? [{ id: "services", label: "Services Proposés", icon: Wrench, activeColor: "text-orange-400", bgActive: "bg-orange-500/15 border-orange-500/30 text-orange-300 shadow-sm shadow-orange-500/10" }] : []),
                                ...(canEdit ? [{ id: "settings", label: "Réglages", icon: Settings, activeColor: "text-foreground", bgActive: "bg-elevated border-border-strong text-foreground shadow-sm" }] : []),
                            ].filter(t => !isEmpty[t.id]);

                            return ALL_TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <TabsTrigger
                                        key={tab.id}
                                        value={tab.id}
                                        data-tour={`profile-tab-${tab.id}`}
                                        className={cn(
                                            "relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all border cursor-pointer shrink-0 select-none",
                                            isActive
                                                ? cn("scale-[1.01]", tab.bgActive)
                                                : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-hover/80 hover:border-border/40"
                                        )}
                                    >
                                        <tab.icon className={cn("w-3.5 h-3.5 transition-colors", isActive ? tab.activeColor : "text-muted-foreground/80")} />
                                        <span>{tab.label}</span>
                                        {isActive && (
                                            <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-current opacity-80 rounded-full" />
                                        )}
                                    </TabsTrigger>
                                );
                            });
                        })()}
                    </TabsList>
                    </div>

                    {/* Scroll shadow + arrow — right */}
                    <div className={cn(
                        "absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pointer-events-none transition-opacity duration-200",
                        canScrollRight ? "opacity-100" : "opacity-0"
                    )}>
                        <button
                            aria-label="Faire défiler vers la droite"
                            onClick={() => scrollTabs("right")}
                            className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-xl bg-surface/90 border border-border/80 shadow-md text-muted-foreground hover:text-foreground hover:bg-elevated transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area (Full Width) */}
                <div className="min-w-0 space-y-8">
                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="animate-in fade-in duration-300">
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

                        {/* Badges & Achievements Vitrine (#198.2) */}
                        <div className="sm:col-span-2">
                            <BadgesVitrine
                                profileId={profile.id}
                                displayName={displayName}
                            />
                        </div>
                    </div>
                </TabsContent>

                {/* INTRODUCTION / PRESENTATION TAB */}
                <TabsContent value="intro" className="animate-in fade-in duration-300">
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
                <TabsContent value="dofus" className="min-h-[60vh] animate-in fade-in duration-300">
                    {visitedTabs.has("dofus") && (
                        <ProfileDofusTab
                            guildId={guildId}
                            profileId={localProfile.id}
                            readOnly={!canEdit}
                        />
                    )}
                </TabsContent>

                {/* SERVICES TAB */}
                <TabsContent value="services" className="animate-in fade-in duration-300">
                    {visitedTabs.has("services") && (
                        <ProfileServicesTab
                            guildId={guildId}
                            activeServices={(localProfile as any).activeServices || []}
                            readOnly={!canEdit}
                        />
                    )}
                </TabsContent>

                {/* ACTIVITY & PRESENCE TAB */}
                <TabsContent value="activity" className="animate-in fade-in duration-300">
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
                <TabsContent value="combat" className="animate-in fade-in duration-300">
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
                <TabsContent value="skins" className="animate-in fade-in duration-300">
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
                <TabsContent value="mules" className="animate-in fade-in duration-300">
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
                <TabsContent value="planning" className="animate-in fade-in duration-300 flex flex-col gap-6">
                    {visitedTabs.has("planning") && (
                        <>
                            {/* #4 — Lien vers l'agenda de guilde depuis le planning perso */}
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="space-y-0.5">
                                    <h3 className="text-title font-bold text-foreground">Mon planning perso</h3>
                                    <p className="text-caption text-muted-foreground">Vos créneaux de jeu et vos absences, pour la planification des événements.</p>
                                </div>
                                <Link
                                    href={`/dashboard/${guildId}/planning`}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-success/30 bg-success/10 text-success text-sm font-semibold hover:bg-success/20 transition-colors duration-200"
                                >
                                    <Calendar className="w-4 h-4" />
                                    Planning de Guilde
                                </Link>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2" data-tour="profile-planning">
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
                        </>
                    )}
                </TabsContent>

                {/* ACHIEVEMENTS TAB */}
                <TabsContent value="achievements" className="animate-in fade-in duration-300">
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
                            canManualSyncLadder={canManualSyncLadder}
                        />
                    )}
                </TabsContent>

                 {/* MÉTIERS TAB */}
                 <TabsContent value="metiers" className="animate-in fade-in duration-300">
                     {visitedTabs.has("metiers") && (
                         <JobsGrid
                             jobs={localProfile.metiers || []}
                             forgemagieStatus={(localProfile.forgemagieStatus as ForgemagieStatusId) || "UNAVAILABLE"}
                             onSaveJobs={handleJobsSave}
                             onSaveForgemagieStatus={handleForgemagieStatusSave}
                             readOnly={!canEdit}
                         />
                     )}
                 </TabsContent>

                 {/* ARTISANAT TAB */}
                 <TabsContent value="artisanat" className="animate-in fade-in duration-300">
                     {visitedTabs.has("artisanat") && (
                         <div className="space-y-12">
                             <LegendaryCrafting 
                                 guildId={guildId}
                                 profileId={localProfile.id}
                                 metiers={metierIds(localProfile.metiers)}
                                 readOnly={!canEdit}
                             />
                             {/* #69 — en lecture seule, la « Croquette Légendaire » n'apparaît QUE si
                                 le joueur l'a activée dans son profil (pas de bloc mort « Service non
                                 disponible » pour les autres). Côté éditable (profil perso), toujours visible. */}
                             {(canEdit || localProfile.hasLegendaryPet) && (
                                 <div className="border-t border-border pt-8">
                                     <LegendaryPetToggle
                                         guildId={guildId}
                                         initialValue={localProfile.hasLegendaryPet ?? false}
                                         readOnly={!canEdit}
                                     />
                                 </div>
                             )}
                         </div>
                     )}
                 </TabsContent>



                {/* SETTINGS TAB */}
                {canEdit && (
                    <TabsContent value="settings" className="animate-in fade-in duration-300">
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
