import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { cn } from "@/lib/utils";
import {
    Settings, Bell, Key, Moon, Users, Calendar, Sword, Target, BarChart3,
    HandCoins, ArrowLeft, ChevronRight, Loader2, Save, AlertTriangle, Hash, Megaphone,
    ShieldAlert, UserCheck, Sparkles, Gem
} from "lucide-react";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobUnlocker } from "../archimonstres/_components/metamob-unlocker";
import { OcreSettingsClient } from "../archimonstres/_components/ocre-settings-client";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";
import { CalendarSettingsClient } from "../calendar/_components/calendar-settings-client";
import { MissionSettingsClient } from "../_components/mission-settings-client";
import { OnboardingSettingsClient } from "../_components/onboarding-settings-client";
import { DiscordSettingsClient } from "../_components/discord-settings-client";
import { MemberSyncButton } from "@/components/admin/member-sync-button";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { DofusSettingsClient } from "@/components/admin/dofus-settings-client";
import { MemberStatsOverview } from "@/components/admin/member-stats-overview";
import { MemberManagementTable } from "@/components/admin/member-management-table";
import { getGuildMemberStats, getGuildMembers } from "@/server/actions/user-actions";
import { PollSettingsClient } from "../_components/poll-settings-client";
import { DjSettingsClient } from "../_components/dj-settings-client";
import { LoansSettingsClient } from "../_components/loans-settings-client";
import { SystemSettingsClient } from "../_components/system-settings-client";
import { getOnboardingSettings } from "@/server/actions/onboarding-admin-actions";
import { BonusSettingsClient } from "@/components/admin/bonus-settings-client";
import { GuildatonSettingsClient } from "../_components/guildaton-settings-client";
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

function buildNavItems(): SettingsSection[] {
    return [
        { id: "annonces", label: "Annonces Platform", icon: Megaphone, description: "Infos & Maintenances", accent: "indigo" },
        { id: "absences", label: "Absences", icon: Bell, description: "Salon de notifications", accent: "cyan" },
        { id: "songes", label: "Songes", icon: Moon, description: "Runs Songes Infinis", accent: "purple" },
        { id: "calendrier", label: "Calendrier", icon: Calendar, description: "Événements guilde", accent: "green" },
        { id: "donjons", label: "Donjons & Quêtes", icon: Sword, description: "DJ Finder & succès", accent: "blue" },
        { id: "missions", label: "Missions", icon: Target, description: "Notifications & uploads", accent: "amber" },
        { id: "bonus", label: "Bonus de Guilde", icon: Gem, description: "Oracles & notifications", accent: "purple" },
        { id: "prets", label: "Prêts & Coffre", icon: HandCoins, description: "Notifications internes", accent: "emerald" },
        { id: "metamob", label: "Metamob", icon: Key, description: "API & Archimonstres", accent: "amber" },
        { id: "dofus", label: "Dofus", icon: Sword, description: "Serveur de jeu", accent: "indigo" },
        { id: "sondages", label: "Sondages", icon: BarChart3, description: "Sondages Discord", accent: "cyan" },
        { id: "discord", label: "Discord Notifications", icon: Hash, description: "Salons & Pings Reset", accent: "indigo" },
        { id: "guildaton", label: "Guildaton Admin", icon: Trophy, description: "Reminders & Admin Channel", accent: "emerald" },
        { id: "onboarding", label: "Accueil & Intro", icon: Sparkles, description: "Welcome & Badges", accent: "rose" },
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
    const activeTab = tab || "absences";

    const user = await getUserContext(guildId);
    if (!user.canViewSettings) {
        await logAdminAccessDenied(guildId, "/admin/settings");
        return <AccessDenied />;
    }

    const onboardingRes = await getOnboardingSettings(guildId);
    const welcomeBadgeName = onboardingRes.success ? (onboardingRes.data as any).welcomeBadgeName : "Nouveau";

    const navItems = buildNavItems();
    const activeItem = navItems.find(n => n.id === activeTab) ?? navItems[0];
    const a = ACCENT[activeItem.accent] ?? ACCENT.slate;

    return (
        <div className="space-y-6 pb-12 w-full max-w-[1600px] mx-auto">
            <UnifiedModuleHeader
                title="Paramètres"
                description="Intégrations Discord, Metamob, Dofus et gestion des membres"
                icon={Settings}
                backHref={`/dashboard/${guildId}/admin`}
            />

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                {/* ── SIDEBAR NAVIGATION ── */}
                <nav className={cn(
                    "w-full lg:w-72 shrink-0 lg:sticky lg:top-4 z-20 space-y-1 lg:space-y-1.5 p-2 rounded-2xl border border-white/8 bg-zinc-900/40 backdrop-blur-xl",
                    "flex lg:flex-col items-center lg:items-stretch overflow-x-auto lg:overflow-visible no-scrollbar hide-scrollbar"
                )}>
                    {/* Shadow indicators for mobile horizontal scroll (Standard 2026) */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-zinc-950/50 to-transparent pointer-events-none lg:hidden z-30" />
                    
                    {navItems.map((item) => {
                        const isActive = item.id === activeTab;
                        const ac = ACCENT[item.accent] ?? ACCENT.slate;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.id}
                                href={`/dashboard/${guildId}/admin/settings?tab=${item.id}`}
                                className={cn(
                                    "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 whitespace-nowrap lg:whitespace-normal",
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
                </nav>

                {/* ── CONTENT AREA ── */}
                <div className="flex-1 w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
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
                    {activeTab === "annonces" && <SystemSettingsClient guildId={guildId} />}
                    {activeTab === "absences" && <AbsenceSettingsClient guildId={guildId} />}
                    {activeTab === "songes" && <SongesSettingsClient guildId={guildId} />}
                    {activeTab === "calendrier" && <CalendarSettingsClient guildId={guildId} />}
                    {activeTab === "donjons" && <DjSettingsClient guildId={guildId} />}
                    {activeTab === "missions" && <MissionSettingsClient guildId={guildId} />}
                    {activeTab === "bonus" && <BonusSettingsClient guildId={guildId} />}
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
                    {activeTab === "onboarding" && <OnboardingSettingsClient guildId={guildId} />}
                    {activeTab === "discord" && <DiscordSettingsClient guildId={guildId} />}
                    {activeTab === "guildaton" && <GuildatonSettingsClient guildId={guildId} />}


                </div>
            </div>
        </div>
    );
}
