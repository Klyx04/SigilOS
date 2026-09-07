import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { cn } from "@/lib/utils";
import { db } from "@/lib/prisma";
import {
    Settings, Bell, Key, Moon, Users, Calendar, Sword, Target, BarChart3,
    HandCoins, ArrowLeft, ChevronRight, Loader2, Save, AlertTriangle, Hash, Megaphone,
    ShieldAlert, UserCheck, Sparkles, Gem, Layout, Palette
} from "lucide-react";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobUnlocker } from "../archimonstres/_components/metamob-unlocker";
import { OcreSettingsClient } from "../archimonstres/_components/ocre-settings-client";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";
import { CalendarSettingsClient } from "../calendar/_components/calendar-settings-client";
import { MissionSettingsClient } from "../_components/mission-settings-client";
import { MemberSyncButton } from "@/components/admin/member-sync-button";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";
import { DofusSettingsClient } from "@/components/admin/dofus-settings-client";
import { MemberStatsOverview } from "@/components/admin/member-stats-overview";
import { MemberManagementTable } from "@/components/admin/member-management-table";
import { getGuildMemberStats, getGuildMembers } from "@/server/actions/user-actions";
import { PollSettingsClient } from "../_components/poll-settings-client";
import { DjSettingsClient } from "../_components/dj-settings-client";
import { LoansSettingsClient } from "../_components/loans-settings-client";
import { SystemSettingsClient } from "../_components/system-settings-client";
import { BonusSettingsClient } from "@/components/admin/bonus-settings-client";
import { BlacklistSettingsClient } from "../_components/blacklist-settings-client";
import { RelanceSettingsClient } from "../_components/relance-settings-client";
import { GallerySettingsClient } from "../_components/gallery-settings-client";
import { DirectorySettingsClient } from "../_components/directory-settings-client";
import { ServicesSettingsClient } from "../_components/services-settings-client";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { GuildStorageCard } from "@/components/admin/guild-storage-card";
import { GuildAppearanceSettingsClient } from "../_components/guild-appearance-settings-client";

// ============================================================================
// NAV ITEMS
// ============================================================================

type SettingsSection = {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    accent: string;
    /**
     * Refonte settings — module de guilde requis pour afficher la section.
     * Absent = structurel (toujours affiché). État effectif = toggle guilde +
     * verrou God (getGuildModules).
     */
    module?: string | null;
};

type SettingsGroup = {
    title: string;
    items: SettingsSection[];
};

function buildNavGroups(): SettingsGroup[] {
    return [
        {
            title: "Guilde",
            items: [
                { id: "dofus", label: "Serveur Dofus", icon: Sword, description: "Configuration du serveur", accent: "emerald", module: null },
                { id: "apparence", label: "Apparence", icon: Palette, description: "Mode sombre & couleur de guilde", accent: "emerald", module: null },
                { id: "annuaire", label: "Annuaire", icon: UserCheck, description: "Sollicitations de membres", accent: "emerald", module: "roster" },
            ]
        },
        {
            title: "Notifications & Canaux",
            items: [
                { id: "annonces", label: "Annonces Plateforme", icon: Megaphone, description: "Infos & Maintenances", accent: "emerald", module: null },
                { id: "absences", label: "Absences", icon: Bell, description: "Salon de notifications", accent: "emerald", module: null },
                { id: "relance", label: "Relances", icon: Bell, description: "Canal de diffusion des relances", accent: "emerald", module: null },
                { id: "sondages", label: "Sondages", icon: BarChart3, description: "Sondages Discord", accent: "emerald", module: "polls" },
                { id: "blacklist", label: "Blacklist Sync", icon: ShieldAlert, description: "Synchro Discord Blacklist", accent: "emerald", module: null },
            ]
        },
        {
            title: "Par Module",
            items: [
                { id: "calendrier", label: "Calendrier", icon: Calendar, description: "Événements guilde", accent: "emerald", module: "calendar" },
                { id: "donjons", label: "Donjons & Songes", icon: Sword, description: "DJ Finder & Songes Infinis", accent: "emerald", module: "donjons" },
                { id: "missions", label: "Missions & Bonus", icon: Target, description: "Notifications, uploads & oracles", accent: "emerald", module: "missions" },
                { id: "prets", label: "Prêts & Coffre", icon: HandCoins, description: "Notifications internes", accent: "emerald", module: null },
                { id: "metamob", label: "Quête Ocre", icon: Key, description: "Suivi & Échanges d'Archis", accent: "emerald", module: "ocre" },
                { id: "gallery", label: "Galerie", icon: Layout, description: "Salons Stuffs & Skins", accent: "emerald", module: "gallery" },
                { id: "services", label: "Services Guilde", icon: Trophy, description: "Salon de mention des passeurs", accent: "emerald", module: "services" },
            ]
        }
    ];
}

const ACCENT: Record<string, { border: string; text: string; bg: string; pill: string }> = {
    emerald: { border: "border-success/30", text: "text-success", bg: "bg-success/10", pill: "bg-success/20 text-success" },
    slate: { border: "border-border/30", text: "text-muted-foreground", bg: "bg-muted/10", pill: "bg-muted/20 text-muted-foreground" },
};

// ============================================================================
// PAGE
// ============================================================================

export default async function FeatureSettingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ tab?: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const { tab } = await searchParams;
    
    // Redirect old tabs
    if (tab === "songes") redirect(`/dashboard/${guildId}/admin/settings?tab=donjons`);
    if (tab === "bonus") redirect(`/dashboard/${guildId}/admin/settings?tab=missions`);
    if (tab === "discord") redirect(`/dashboard/${guildId}/admin/settings?tab=annonces`);
    if (tab === "onboarding") redirect(`/dashboard/${guildId}/admin/settings?tab=annonces`);
    
    const activeTab = tab || "annonces";

    const user = await getUserContext(guildId);
    if (!user.canViewSettings) {
        await logAdminAccessDenied(guildId, "/admin/settings");
        return <AccessDenied />;
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { dofusServerId: true, accentHue: true }
    });
    const isDofusConfigured = !!guild?.dofusServerId;

    // Refonte settings — la nav suit les modules effectifs (toggle + verrou God).
    const { getGuildModules } = await import("@/server/actions/module-actions");
    const { getVisibleSettingsNav, SETTINGS_TAB_MODULES } = await import("@/lib/settings-nav");
    const effectiveModules = await getGuildModules(guildId).catch(() => null) as unknown as Record<string, boolean> | null;
    const navGroups = getVisibleSettingsNav(buildNavGroups(), effectiveModules);
    const navItems = navGroups.flatMap(g => g.items);
    // Onglet demandé mais module coupé (lien direct/bookmark) : repli premier visible.
    const requestedModule = SETTINGS_TAB_MODULES[activeTab];
    const requestedOff = requestedModule && effectiveModules && !effectiveModules[requestedModule];
    const activeItem = (!requestedOff ? navItems.find(n => n.id === activeTab) : undefined) ?? navItems[0];
    const resolvedTab = activeItem.id;
    const a = ACCENT[activeItem.accent] ?? ACCENT.slate;

    return (
        <div className="space-y-6 pb-12 w-full max-w-[1600px] mx-auto">
            <div data-tour="admin-settings-header">
                <UnifiedModuleHeader
                    title="Paramètres"
                    description="Intégrations Discord, Metamob, Dofus et gestion des membres"
                    icon={Settings}
                    backHref={`/dashboard/${guildId}/admin`}
                    actions={<ModuleHelpActions docSlug="admin-settings" docTitle="Paramètres Généraux" tourPhase="adminSettings" />}
                />
            </div>

            {/* Quota & stockage visible par l'admin guilde */}
            <GuildStorageCard guildId={guildId} />

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                {/* ── SIDEBAR NAVIGATION ── */}
                <nav data-tour="admin-settings-nav" className={cn(
                    "w-full lg:w-72 shrink-0 lg:sticky lg:top-4 z-20 space-y-1 lg:space-y-1.5 p-2 rounded-2xl border border-white/8 bg-surface/40 backdrop-blur-xl",
                    "flex lg:flex-col items-center lg:items-stretch overflow-x-auto lg:overflow-visible no-scrollbar hide-scrollbar"
                )}>
                    {/* Shadow indicators for mobile horizontal scroll (Standard 2026) */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/50 to-transparent pointer-events-none lg:hidden z-30" />
                    
                    {navGroups.map((group, idx) => (
                        <div key={idx} className="flex flex-row lg:flex-col items-center lg:items-stretch mb-0 lg:mb-4 lg:last:mb-0 shrink-0">
                            <h3 className="hidden lg:block text-caption font-black uppercase tracking-widest text-muted-foreground px-4 mb-2 mt-1">{group.title}</h3>
                            {group.items.map((item) => {
                                const isActive = item.id === resolvedTab;
                                const ac = ACCENT[item.accent] ?? ACCENT.slate;
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.id}
                                        href={`/dashboard/${guildId}/admin/settings?tab=${item.id}`}
                                        className={cn(
                                            "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 whitespace-nowrap lg:whitespace-normal shrink-0",
                                            isActive
                                                ? `${ac.bg} ${ac.border} border `
                                                : "border border-transparent hover:bg-surface hover:border-white/8 text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300",
                                            isActive ? ac.bg : "bg-surface group-hover:bg-surface group-"
                                        )}>
                                            <Icon className={cn("w-4 h-4", isActive ? ac.text : "text-muted-foreground group-hover:text-foreground")} />
                                        </div>
                                        <div className="min-w-0 flex-1 hidden lg:block">
                                            <p className={cn("text-xs font-black uppercase tracking-widest leading-none mb-1", isActive ? ac.text : "text-muted-foreground group-hover:text-foreground")}>
                                                {item.label}
                                            </p>
                                            <p className="text-caption text-muted-foreground truncate font-medium group-hover:text-muted-foreground transition-colors">
                                                {item.description}
                                            </p>
                                        </div>
                                        {/* Mobile display: only label */}
                                        <span className={cn("text-xs font-black uppercase tracking-widest lg:hidden", isActive ? ac.text : "")}>
                                            {item.label}
                                        </span>
                                        {isActive && <ChevronRight className={cn("w-4 h-4 shrink-0 hidden lg:block", ac.text)} />}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* ── CONTENT AREA ── */}
                <div data-tour="admin-settings-pane" className="flex-1 w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-300 delay-150">
                    {/* Section visual header */}
                    <div className={cn(
                        "relative flex flex-col sm:flex-row sm:items-center gap-5 mb-8 p-6 rounded-3xl border overflow-hidden",
                        a.border, a.bg
                    )}>
                        <div className={cn(
                            "relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-colors duration-200",
                            a.bg, a.border
                        )}>
                            {(() => { const Icon = activeItem.icon; return <Icon className={cn("w-7 h-7", a.text)} />; })()}
                        </div>
                        <div className="space-y-1">
                            <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold uppercase tracking-widest mb-1", a.pill)}>
                                Section Configuration
                            </div>
                            <h2 className={cn("text-title font-bold leading-tight", a.text)}>
                                {activeItem.label}
                            </h2>
                            <p className="text-sm text-muted-foreground font-medium max-w-xl opacity-80">
                                {activeItem.description} — Gérez les paramètres de ce module pour votre guilde.
                            </p>
                        </div>
                    </div>

                    {/* Content pane */}
                    {requestedOff && (
                        <div className="mb-6 p-4 rounded-2xl border border-info/30 bg-info/10 flex items-center justify-between gap-4 flex-wrap">
                            <p className="text-xs text-info font-medium">
                                Cette section est masquée car son module est désactivé.
                            </p>
                            <Link
                                href={`/dashboard/${guildId}/admin/modules`}
                                className="text-xs font-black uppercase tracking-wider text-info hover:underline"
                            >
                                Gérer les modules →
                            </Link>
                        </div>
                    )}
                    {!isDofusConfigured && resolvedTab !== "dofus" ? (
                        <div className="p-6 rounded-2xl border border-warning/20 bg-warning/10 flex flex-col items-center justify-center text-center gap-4 animate-in fade-in slide-in-from-bottom-4 min-h-[300px]">
                            <div className="p-4 rounded-full bg-warning/20 mb-2">
                                <Sword className="w-8 h-8 text-warning" />
                            </div>
                            <h3 className="text-xl font-black text-warning tracking-tight uppercase">Configuration Dofus Requise</h3>
                            <p className="text-sm text-warning/80 max-w-md">
                                Pour pouvoir utiliser et configurer les autres modules, vous devez d'abord lier votre guilde à un serveur Dofus.
                            </p>
                            <Link
                                href={`/dashboard/${guildId}/admin/settings?tab=dofus`}
                                className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-warning text-warning-foreground text-sm font-bold uppercase tracking-wider hover:bg-warning transition-colors "
                            >
                                Configurer le Serveur
                            </Link>
                        </div>
                    ) : (
                        <>
                            {resolvedTab === "annonces" && <SystemSettingsClient guildId={guildId} />}
                            {resolvedTab === "absences" && <AbsenceSettingsClient guildId={guildId} />}
                            {resolvedTab === "calendrier" && <CalendarSettingsClient guildId={guildId} />}
                            {resolvedTab === "donjons" && (
                                <div className="space-y-8">
                                    <DjSettingsClient guildId={guildId} />
                                    <div className="pt-8 border-t border-border">
                                        <SongesSettingsClient guildId={guildId} />
                                    </div>
                                </div>
                            )}
                            {resolvedTab === "missions" && (
                                <div className="space-y-8">
                                    <MissionSettingsClient guildId={guildId} />
                                    <div className="pt-8 border-t border-border">
                                        <BonusSettingsClient guildId={guildId} />
                                    </div>
                                </div>
                            )}
                            {resolvedTab === "prets" && <LoansSettingsClient guildId={guildId} />}
                            {resolvedTab === "metamob" && (
                                <div className="space-y-8">
                                    <OcreSettingsClient guildId={guildId} />
                                    <div className="pt-6 border-t border-border max-w-4xl">
                                        <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4 text-warning" />
                                            Zone de Maintenance
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-4">Outils de dépannage pour les cas particuliers.</p>
                                        <MetamobUnlocker guildId={guildId} />
                                    </div>
                                </div>
                            )}
                            {resolvedTab === "dofus" && <DofusSettingsClient guildId={guildId} />}
                            {resolvedTab === "sondages" && <PollSettingsClient guildId={guildId} />}
                            { resolvedTab === "blacklist" && <BlacklistSettingsClient guildId={guildId} /> }
                            { resolvedTab === "relance" && <RelanceSettingsClient guildId={guildId} /> }
                            { resolvedTab === "gallery" && <GallerySettingsClient guildId={guildId} /> }
                            { resolvedTab === "annuaire" && <DirectorySettingsClient guildId={guildId} /> }
                            { resolvedTab === "services" && <ServicesSettingsClient guildId={guildId} /> }
                            { resolvedTab === "apparence" && <GuildAppearanceSettingsClient guildId={guildId} initialHue={guild?.accentHue ?? null} /> }
                        </>
                    )}


                </div>
            </div>
        </div>
    );
}