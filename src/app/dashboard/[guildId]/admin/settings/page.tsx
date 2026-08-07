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
    ShieldAlert, UserCheck, Sparkles, Gem, Layout
} from "lucide-react";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobUnlocker } from "../archimonstres/_components/metamob-unlocker";
import { OcreSettingsClient } from "../archimonstres/_components/ocre-settings-client";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";
import { CalendarSettingsClient } from "../calendar/_components/calendar-settings-client";
import { MissionSettingsClient } from "../_components/mission-settings-client";
import { MemberSyncButton } from "@/components/admin/member-sync-button";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { AdminTourReplay } from "@/components/tour/admin-tour-replay";
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
import { GallerySettingsClient } from "../_components/gallery-settings-client";
import { DirectorySettingsClient } from "../_components/directory-settings-client";
import { ServicesSettingsClient } from "../_components/services-settings-client";
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
};

type SettingsGroup = {
    title: string;
    items: SettingsSection[];
};

function buildNavGroups(): SettingsGroup[] {
    return [
        {
            title: "Système & Canaux",
            items: [
                { id: "annonces", label: "Annonces Plateforme", icon: Megaphone, description: "Infos & Maintenances", accent: "indigo" },
                { id: "absences", label: "Absences", icon: Bell, description: "Salon de notifications", accent: "cyan" },
                { id: "sondages", label: "Sondages", icon: BarChart3, description: "Sondages Discord", accent: "cyan" },
            ]
        },
        {
            title: "Gestion de Guilde",
            items: [
                { id: "dofus", label: "Serveur Dofus", icon: Sword, description: "Configuration du serveur", accent: "indigo" },
                { id: "annuaire", label: "Annuaire", icon: UserCheck, description: "Sollicitations de membres", accent: "indigo" },
                { id: "blacklist", label: "Blacklist Sync", icon: ShieldAlert, description: "Synchro Discord Blacklist", accent: "rose" },
            ]
        },
        {
            title: "Modules de Jeu",
            items: [
                { id: "calendrier", label: "Calendrier", icon: Calendar, description: "Événements guilde", accent: "green" },
                { id: "donjons", label: "Donjons & Songes", icon: Sword, description: "DJ Finder & Songes Infinis", accent: "blue" },
                { id: "missions", label: "Missions & Bonus", icon: Target, description: "Notifications, uploads & oracles", accent: "amber" },
                { id: "prets", label: "Prêts & Coffre", icon: HandCoins, description: "Notifications internes", accent: "emerald" },
                { id: "metamob", label: "Quête Ocre", icon: Key, description: "Suivi & Échanges d'Archis", accent: "amber" },
                { id: "gallery", label: "Galerie", icon: Layout, description: "Salons Stuffs & Skins", accent: "pink" },
                { id: "services", label: "Services Guilde", icon: Trophy, description: "Salon de mention des passeurs", accent: "purple" },
            ]
        }
    ];
}

const ACCENT: Record<string, { border: string; text: string; bg: string; pill: string }> = {
    cyan: { border: "border-cyan-500/30", text: "text-cyan-400", bg: "bg-cyan-500/10", pill: "bg-cyan-500/20 text-cyan-400" },
    purple: { border: "border-purple-500/30", text: "text-purple-400", bg: "bg-purple-500/10", pill: "bg-purple-500/20 text-purple-400" },
    green: { border: "border-green-500/30", text: "text-green-400", bg: "bg-green-500/10", pill: "bg-green-500/20 text-green-400" },
    blue: { border: "border-blue-500/30", text: "text-blue-400", bg: "bg-blue-500/10", pill: "bg-blue-500/20 text-blue-400" },
    amber: { border: "border-amber-500/30", text: "text-amber-400", bg: "bg-amber-500/10", pill: "bg-amber-500/20 text-amber-400" },
    emerald: { border: "border-emerald-500/30", text: "text-emerald-400", bg: "bg-emerald-500/10", pill: "bg-emerald-500/20 text-emerald-400" },
    indigo: { border: "border-indigo-500/30", text: "text-indigo-400", bg: "bg-indigo-500/10", pill: "bg-indigo-500/20 text-indigo-400" },
    violet: { border: "border-violet-500/30", text: "text-violet-400", bg: "bg-violet-500/10", pill: "bg-violet-500/20 text-violet-400" },
    rose: { border: "border-rose-500/30", text: "text-rose-400", bg: "bg-rose-500/10", pill: "bg-rose-500/20 text-rose-400" },
    pink: { border: "border-pink-500/30", text: "text-pink-400", bg: "bg-pink-500/10", pill: "bg-pink-500/20 text-pink-400" },
    slate: { border: "border-slate-500/30", text: "text-slate-400", bg: "bg-slate-500/10", pill: "bg-slate-500/20 text-slate-400" },
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
        select: { dofusServerId: true }
    });
    const isDofusConfigured = !!guild?.dofusServerId;

    const navGroups = buildNavGroups();
    const navItems = navGroups.flatMap(g => g.items);
    const activeItem = navItems.find(n => n.id === activeTab) ?? navItems[0];
    const a = ACCENT[activeItem.accent] ?? ACCENT.slate;

    return (
        <div className="space-y-6 pb-12 w-full max-w-[1600px] mx-auto">
            <div data-tour="admin-settings-header">
                <UnifiedModuleHeader
                    title="Paramètres"
                    description="Intégrations Discord, Metamob, Dofus et gestion des membres"
                    icon={Settings}
                    backHref={`/dashboard/${guildId}/admin`}
                    actions={<AdminTourReplay user={user} />}
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                {/* ── SIDEBAR NAVIGATION ── */}
                <nav data-tour="admin-settings-nav" className={cn(
                    "w-full lg:w-72 shrink-0 lg:sticky lg:top-4 z-20 space-y-1 lg:space-y-1.5 p-2 rounded-2xl border border-white/8 bg-zinc-900/40 backdrop-blur-xl",
                    "flex lg:flex-col items-center lg:items-stretch overflow-x-auto lg:overflow-visible no-scrollbar hide-scrollbar"
                )}>
                    {/* Shadow indicators for mobile horizontal scroll (Standard 2026) */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-zinc-950/50 to-transparent pointer-events-none lg:hidden z-30" />
                    
                    {navGroups.map((group, idx) => (
                        <div key={idx} className="flex flex-row lg:flex-col items-center lg:items-stretch mb-0 lg:mb-4 lg:last:mb-0 shrink-0">
                            <h3 className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 mb-2 mt-1">{group.title}</h3>
                            {group.items.map((item) => {
                                const isActive = item.id === activeTab;
                                const ac = ACCENT[item.accent] ?? ACCENT.slate;
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.id}
                                        href={`/dashboard/${guildId}/admin/settings?tab=${item.id}`}
                                        className={cn(
                                            "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 whitespace-nowrap lg:whitespace-normal shrink-0",
                                            isActive
                                                ? `${ac.bg} ${ac.border} border shadow-[0_0_20px_rgba(0,0,0,0.2)]`
                                                : "border border-transparent hover:bg-white/[0.03] hover:border-white/8 text-zinc-400 hover:text-white"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-500",
                                            isActive ? ac.bg : "bg-white/5 group-hover:bg-white/10 group-hover:scale-110"
                                        )}>
                                            <Icon className={cn("w-4 h-4", isActive ? ac.text : "text-zinc-500 group-hover:text-zinc-200")} />
                                        </div>
                                        <div className="min-w-0 flex-1 hidden lg:block">
                                            <p className={cn("text-xs font-black uppercase tracking-widest leading-none mb-1", isActive ? ac.text : "text-zinc-400 group-hover:text-white")}>
                                                {item.label}
                                            </p>
                                            <p className="text-[10px] text-zinc-500 truncate font-medium group-hover:text-zinc-400 transition-colors">
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
                <div data-tour="admin-settings-pane" className="flex-1 w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                    {/* Section visual header */}
                    <div className={cn(
                        "relative flex flex-col sm:flex-row sm:items-center gap-5 mb-8 p-6 rounded-3xl border overflow-hidden",
                        a.border, a.bg
                    )}>
                        <div className={cn(
                            "relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xl transition-transform duration-500 hover:scale-105",
                            a.bg, a.border
                        )}>
                            {(() => { const Icon = activeItem.icon; return <Icon className={cn("w-7 h-7", a.text)} />; })()}
                            <div className={cn("absolute inset-0 blur-xl opacity-20", a.bg)} />
                        </div>
                        <div className="space-y-1">
                            <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-1 share-glass-strong", a.pill)}>
                                Section Configuration
                            </div>
                            <h2 className={cn("text-2xl font-black tracking-tighter uppercase leading-none", a.text)}>
                                {activeItem.label}
                            </h2>
                            <p className="text-sm text-zinc-500 font-medium max-w-xl opacity-80">
                                {activeItem.description} — Gérez les paramètres de ce module pour votre guilde.
                            </p>
                        </div>
                        
                        {/* Decorative background glow */}
                        <div className={cn("absolute -top-10 -right-10 w-40 h-40 blur-[100px] opacity-10 pointer-events-none", a.bg)} />
                    </div>

                    {/* Content pane */}
                    {!isDofusConfigured && activeTab !== "dofus" ? (
                        <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 flex flex-col items-center justify-center text-center gap-4 animate-in fade-in slide-in-from-bottom-4 min-h-[300px]">
                            <div className="p-4 rounded-full bg-amber-500/20 mb-2">
                                <Sword className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-black text-amber-400 tracking-tight uppercase">Configuration Dofus Requise</h3>
                            <p className="text-sm text-amber-500/80 max-w-md">
                                Pour pouvoir utiliser et configurer les autres modules, vous devez d'abord lier votre guilde à un serveur Dofus.
                            </p>
                            <Link
                                href={`/dashboard/${guildId}/admin/settings?tab=dofus`}
                                className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-500 text-amber-950 text-sm font-bold uppercase tracking-wider hover:bg-amber-400 transition-colors shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                            >
                                Configurer le Serveur
                            </Link>
                        </div>
                    ) : (
                        <>
                            {activeTab === "annonces" && <SystemSettingsClient guildId={guildId} />}
                            {activeTab === "absences" && <AbsenceSettingsClient guildId={guildId} />}
                            {activeTab === "calendrier" && <CalendarSettingsClient guildId={guildId} />}
                            {activeTab === "donjons" && (
                                <div className="space-y-8">
                                    <DjSettingsClient guildId={guildId} />
                                    <div className="pt-8 border-t border-white/5">
                                        <SongesSettingsClient guildId={guildId} />
                                    </div>
                                </div>
                            )}
                            {activeTab === "missions" && (
                                <div className="space-y-8">
                                    <MissionSettingsClient guildId={guildId} />
                                    <div className="pt-8 border-t border-white/5">
                                        <BonusSettingsClient guildId={guildId} />
                                    </div>
                                </div>
                            )}
                            {activeTab === "prets" && <LoansSettingsClient guildId={guildId} />}
                            {activeTab === "metamob" && (
                                <div className="space-y-8">
                                    <OcreSettingsClient guildId={guildId} />
                                    <div className="pt-6 border-t border-white/5 max-w-4xl">
                                        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                                            Zone de Maintenance
                                        </h3>
                                        <p className="text-sm text-zinc-500 mb-4">Outils de dépannage pour les cas particuliers.</p>
                                        <MetamobUnlocker guildId={guildId} />
                                    </div>
                                </div>
                            )}
                            {activeTab === "dofus" && <DofusSettingsClient guildId={guildId} />}
                            {activeTab === "sondages" && <PollSettingsClient guildId={guildId} />}
                            { activeTab === "blacklist" && <BlacklistSettingsClient guildId={guildId} /> }
                            { activeTab === "gallery" && <GallerySettingsClient guildId={guildId} /> }
                            { activeTab === "annuaire" && <DirectorySettingsClient guildId={guildId} /> }
                            { activeTab === "services" && <ServicesSettingsClient guildId={guildId} /> }
                        </>
                    )}


                </div>
            </div>
        </div>
    );
}