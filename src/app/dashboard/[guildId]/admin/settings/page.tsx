import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { cn } from "@/lib/utils";
import { db } from "@/lib/prisma";
import {
    Settings, Bell, Key, Calendar, Sword, Target, BarChart3,
    HandCoins, ChevronRight, Megaphone,
    ShieldAlert, UserCheck, Layout, Clock,
    Store, HardDrive
} from "lucide-react";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobUnlocker } from "../archimonstres/_components/metamob-unlocker";
import { OcreSettingsClient } from "../archimonstres/_components/ocre-settings-client";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";
import { CalendarSettingsClient } from "../calendar/_components/calendar-settings-client";
import { MissionSettingsClient } from "../_components/mission-settings-client";
import { SeniorityRolesSettingsClient } from "../_components/seniority-roles-settings-client";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";
import { DofusSettingsClient } from "@/components/admin/dofus-settings-client";
import { PollSettingsClient } from "../_components/poll-settings-client";
import { ScheduledPollSettingsClient } from "../_components/scheduled-poll-settings-client";
import { DjSettingsClient } from "../_components/dj-settings-client";
import { LoansSettingsClient } from "../_components/loans-settings-client";
import { SystemSettingsClient } from "../_components/system-settings-client";
import { BonusSettingsClient } from "@/components/admin/bonus-settings-client";
import { BlacklistSettingsClient } from "../_components/blacklist-settings-client";
import { RelanceSettingsClient } from "../_components/relance-settings-client";
import { GallerySettingsClient } from "../_components/gallery-settings-client";
import { DirectorySettingsClient } from "../_components/directory-settings-client";
import { ServicesSettingsClient } from "../_components/services-settings-client";
import { MarketSettingsClient } from "../_components/market-settings-client";
import { KamaSettingsClient } from "../_components/kama-settings-client";
import { GuildStorageSettingsClient } from "../_components/guild-storage-settings-client";
import Link from "next/link";
import { Trophy } from "lucide-react";

// ============================================================================
// NAV ITEMS
// ============================================================================

type SettingsSection = {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    accent: string;
    dofusAsset?: string;
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
                { id: "dofus", label: "Serveur Dofus", icon: Sword, description: "Configuration du serveur", accent: "emerald", module: null, dofusAsset: "/assets/dofus/modules/dofus.png" },
                { id: "annuaire", label: "Annuaire", icon: UserCheck, description: "Sollicitations de membres", accent: "emerald", module: "roster", dofusAsset: "/assets/dofus/modules/character.png" },
                { id: "stockage", label: "Stockage Guilde", icon: HardDrive, description: "Quotas, captures & transcripts", accent: "emerald", module: null, dofusAsset: "/assets/dofus/modules/chest.png" },
            ]
        },
        {
            title: "Notifications & Canaux",
            items: [
                { id: "annonces", label: "Annonces Plateforme", icon: Megaphone, description: "Infos & Maintenances", accent: "emerald", module: null, dofusAsset: "/assets/dofus/modules/bot_command.png" },
                { id: "absences", label: "Absences & Relances", icon: Bell, description: "Départs vacances & relances", accent: "emerald", module: null, dofusAsset: "/assets/dofus/modules/hourglass.png" },
                { id: "sondages", label: "Sondages", icon: BarChart3, description: "Sondages Discord", accent: "emerald", module: "polls", dofusAsset: "/assets/dofus/modules/dice.png" },
                { id: "blacklist", label: "Blacklist Sync", icon: ShieldAlert, description: "Synchro Discord Blacklist", accent: "emerald", module: null, dofusAsset: "/assets/dofus/modules/starShield.png" },
                { id: "anciennete", label: "Ancienneté", icon: Clock, description: "Salon des annonces de palier", accent: "emerald", module: null, dofusAsset: "/assets/dofus/modules/ladder.png" },
            ]
        },
        {
            title: "Par Module",
            items: [
                { id: "calendrier", label: "Calendrier & Raids", icon: Calendar, description: "Salons événements & raids", accent: "emerald", module: "calendar", dofusAsset: "/assets/dofus/modules/calendar.png" },
                { id: "donjons", label: "Donjons & Songes", icon: Sword, description: "DJ Finder & Songes Infinis", accent: "emerald", module: "donjons", dofusAsset: "/assets/dofus/modules/breach.png" },
                { id: "missions", label: "Missions & Bonus", icon: Target, description: "Notifications & oracles", accent: "emerald", module: "missions", dofusAsset: "/assets/dofus/modules/quest.png" },
                { id: "kamas", label: "Don de Kamas", icon: HandCoins, description: "Seuil, règle raid & preuves", accent: "emerald", module: null, dofusAsset: "/assets/dofus/modules/kamas.png" },
                { id: "prets", label: "Prêts & Coffre", icon: HandCoins, description: "Notifications internes", accent: "emerald", module: null, dofusAsset: "/assets/dofus/modules/chest.png" },
                { id: "metamob", label: "Quête Ocre", icon: Key, description: "Suivi & Échanges d'Archis", accent: "emerald", module: "ocre", dofusAsset: "/assets/dofus/modules/dofus_ocre.png" },
                { id: "gallery", label: "Galerie", icon: Layout, description: "Salons Stuffs & Skins", accent: "emerald", module: "gallery", dofusAsset: "/assets/dofus/modules/cosmetics.png" },
                { id: "services", label: "Services Guilde", icon: Trophy, description: "Salon mention des passeurs", accent: "emerald", module: "services", dofusAsset: "/assets/dofus/modules/guildExperience.png" },
                { id: "marche", label: "Marché", icon: Store, description: "Salon, rôles & annonces", accent: "emerald", module: "marche", dofusAsset: "/assets/dofus/modules/auctionHouseEquipments.png" },
            ]
        }
    ];
}

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
    if (tab === "relance") redirect(`/dashboard/${guildId}/admin/settings?tab=absences`);
    
    const activeTab = tab || "annonces";

    const user = await getUserContext(guildId);
    // ⛔ Un seul écran par réglage : le rôle staff du module « Sondages programmés »
    // gouverne SES réglages (`staff:scheduled_polls`) sans avoir `system:config` —
    // il ouvre donc **l'onglet Sondages** de cette page, et rien d'autre (la nav
    // est filtrée juste en dessous, et l'encart ne vit plus aussi sur la page du module).
    const staffOnlySondages = !user.canViewSettings && user.canSchedulePolls;
    if (!user.canViewSettings && !staffOnlySondages) {
        await logAdminAccessDenied(guildId, "/admin/settings");
        return <AccessDenied />;
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { dofusServerId: true }
    });
    const isDofusConfigured = !!guild?.dofusServerId;

    // Refonte settings — la nav suit les modules effectifs (toggle + verrou God).
    const { getGuildModules } = await import("@/server/actions/module-actions");
    const { getVisibleSettingsNav, SETTINGS_TAB_MODULES } = await import("@/lib/settings-nav");
    const effectiveModules = await getGuildModules(guildId).catch(() => null) as unknown as Record<string, boolean> | null;
    const visibleGroups = getVisibleSettingsNav(buildNavGroups(), effectiveModules);
    // Le rôle staff ne voit QUE l'onglet de son module : les autres réglages de
    // guilde restent hors de sa portée (aucun accès « par effet de bord »).
    const navGroups = staffOnlySondages
        ? visibleGroups
            .map((group) => ({ ...group, items: group.items.filter((item) => item.id === "sondages") }))
            .filter((group) => group.items.length > 0)
        : visibleGroups;
    const navItems = navGroups.flatMap(g => g.items);
    // Onglet demandé mais module coupé (lien direct/bookmark) : repli premier visible.
    const requestedModule = SETTINGS_TAB_MODULES[activeTab];
    const requestedOff = requestedModule && effectiveModules && !effectiveModules[requestedModule];
    const activeItem = (!requestedOff ? navItems.find(n => n.id === activeTab) : undefined) ?? navItems[0];
    const resolvedTab = activeItem.id;

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

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                {/* ── SIDEBAR NAVIGATION ── */}
                <nav data-tour="admin-settings-nav" className={cn(
                    "w-full lg:w-80 shrink-0 lg:sticky lg:top-4 z-20 space-y-2 p-2.5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-xl shadow-xl",
                    "flex lg:flex-col items-center lg:items-stretch overflow-x-auto lg:overflow-visible no-scrollbar hide-scrollbar"
                )}>
                    {/* Shadow indicators for mobile horizontal scroll (Standard 2026) */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/50 to-transparent pointer-events-none lg:hidden z-30" />
                    
                    {navGroups.map((group, idx) => (
                        <div key={idx} className="flex flex-row lg:flex-col items-center lg:items-stretch mb-0 lg:mb-3 lg:last:mb-0 shrink-0">
                            <h3 className="hidden lg:block text-caption font-bold uppercase tracking-wider text-muted-foreground/80 px-3 mb-1.5 mt-1">{group.title}</h3>
                            <div className="space-y-1 w-full flex flex-row lg:flex-col">
                                {group.items.map((item) => {
                                    const isActive = item.id === resolvedTab;
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.id}
                                            href={`/dashboard/${guildId}/admin/settings?tab=${item.id}`}
                                            className={cn(
                                                "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 whitespace-nowrap lg:whitespace-normal shrink-0",
                                                isActive
                                                    ? "bg-amber-500/10 border border-amber-500/30 shadow-md shadow-amber-500/5 text-foreground"
                                                    : "border border-transparent hover:bg-surface/80 hover:border-white/5 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 p-1.5",
                                                isActive
                                                    ? "bg-amber-500/20 border border-amber-500/40 shadow-sm"
                                                    : "bg-surface/90 border border-border/50 group-hover:border-border"
                                            )}>
                                                {item.dofusAsset ? (
                                                    <img
                                                        src={item.dofusAsset}
                                                        alt=""
                                                        className={cn(
                                                            "w-6 h-6 object-contain transition-transform group-hover:scale-105",
                                                            isActive ? "drop-shadow" : "opacity-80 group-hover:opacity-100"
                                                        )}
                                                    />
                                                ) : (
                                                    <Icon className={cn("w-4 h-4", isActive ? "text-amber-400" : "text-muted-foreground group-hover:text-foreground")} />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1 hidden lg:block">
                                                <p className={cn("text-xs font-bold leading-tight mb-0.5", isActive ? "text-foreground font-extrabold" : "text-foreground/80 group-hover:text-foreground")}>
                                                    {item.label}
                                                </p>
                                                <p className="text-caption text-muted-foreground truncate font-medium">
                                                    {item.description}
                                                </p>
                                            </div>
                                            {/* Mobile display: only label */}
                                            <span className={cn("text-xs font-bold lg:hidden", isActive ? "text-amber-400" : "")}>
                                                {item.label}
                                            </span>
                                            {isActive && <ChevronRight className="w-4 h-4 shrink-0 hidden lg:block text-amber-400/80" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* ── CONTENT AREA ── */}
                <div data-tour="admin-settings-pane" className="flex-1 w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-300 delay-150">
                    {/* Section visual header */}
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-5 rounded-2xl border border-border/60 bg-gradient-to-r from-surface/80 via-surface/50 to-surface/80 backdrop-blur-md overflow-hidden shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 p-2 shadow-inner">
                                {activeItem.dofusAsset ? (
                                    <img src={activeItem.dofusAsset} alt="" className="w-8 h-8 object-contain drop-shadow" />
                                ) : (
                                    (() => { const Icon = activeItem.icon; return <Icon className="w-6 h-6 text-amber-400" />; })()
                                )}
                            </div>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-caption font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                        Configuration
                                    </span>
                                    <span className="text-caption text-muted-foreground hidden sm:inline">• {activeItem.description}</span>
                                </div>
                                <h2 className="text-lg font-bold text-foreground">
                                    {activeItem.label}
                                </h2>
                            </div>
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
                            {resolvedTab === "absences" && (
                                <div className="space-y-8">
                                    <AbsenceSettingsClient guildId={guildId} />
                                    <div className="pt-8 border-t border-border">
                                        <RelanceSettingsClient guildId={guildId} />
                                    </div>
                                </div>
                            )}
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
                            {resolvedTab === "kamas" && <KamaSettingsClient guildId={guildId} />}
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
                            {resolvedTab === "sondages" && (
                                <div className="space-y-8">
                                    {/* Sondages classiques : réglage gouverné par `system:config`. */}
                                    {user.canViewSettings && <PollSettingsClient guildId={guildId} />}
                                    <div className={cn("border-t border-border", user.canViewSettings && "pt-8")}>
                                        <ScheduledPollSettingsClient guildId={guildId} />
                                    </div>
                                </div>
                            )}
                            { resolvedTab === "blacklist" && <BlacklistSettingsClient guildId={guildId} /> }
                            { resolvedTab === "anciennete" && <SeniorityRolesSettingsClient guildId={guildId} /> }
                            { resolvedTab === "gallery" && <GallerySettingsClient guildId={guildId} /> }
                            { resolvedTab === "annuaire" && <DirectorySettingsClient guildId={guildId} /> }
                            { resolvedTab === "services" && <ServicesSettingsClient guildId={guildId} /> }
                            { resolvedTab === "marche" && <MarketSettingsClient guildId={guildId} /> }
                            { resolvedTab === "stockage" && <GuildStorageSettingsClient guildId={guildId} /> }
                        </>
                    )}


                </div>
            </div>
        </div>
    );
}