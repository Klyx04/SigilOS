import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import {
    Settings, Bell, Key, Moon, Users, Calendar, Sword, Target, BarChart3,
    HandCoins, ArrowLeft, ChevronRight, Loader2, Save, AlertTriangle, Hash, Megaphone,
    ShieldAlert, UserCheck, Sparkles, Gem
} from "lucide-react";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobSettingsClient } from "../archimonstres/_components/metamob-settings-client";
import { MetamobUnlocker } from "../archimonstres/_components/metamob-unlocker";
import { OcreSettingsClient } from "../archimonstres/_components/ocre-settings-client";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";
import { CalendarSettingsClient } from "../calendar/_components/calendar-settings-client";
import { MissionSettingsClient } from "../_components/mission-settings-client";
import { OnboardingSettingsClient } from "../_components/onboarding-settings-client";
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
import { DeletionPendingPanel } from "@/components/admin/deletion-pending-panel";
import Link from "next/link";


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
        { id: "onboarding", label: "Accueil & Intro", icon: Sparkles, description: "Welcome & Badges", accent: "rose" },
        { id: "membres", label: "Membres & Sync", icon: Users, description: "Gestion & synchronisation", accent: "violet" },
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
    if (!user.isAdmin) {
        await logAdminAccessDenied(guildId, "/admin/settings");
        return <AccessDenied />;
    }

    const memberStats = await getGuildMemberStats(guildId);
    const members = await getGuildMembers(guildId);
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

            <div className="flex gap-6 items-start">
                {/* ── SIDEBAR ── */}
                <nav className="w-64 shrink-0 sticky top-4 space-y-1 rounded-2xl border border-white/8 bg-zinc-900/60 p-2">
                    {navItems.map((item) => {
                        const isActive = item.id === activeTab;
                        const ac = ACCENT[item.accent] ?? ACCENT.slate;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.id}
                                href={`/dashboard/${guildId}/admin/settings?tab=${item.id}`}
                                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive
                                    ? `${ac.bg} ${ac.border} border`
                                    : "border border-transparent hover:bg-white/[0.03] hover:border-white/8"
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? ac.bg : "bg-white/5 group-hover:bg-white/8"}`}>
                                    <Icon className={`w-4 h-4 ${isActive ? ac.text : "text-zinc-400 group-hover:text-zinc-200"}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold truncate ${isActive ? ac.text : "text-zinc-200 group-hover:text-white"}`}>{item.label}</p>
                                    <p className="text-xs text-zinc-400 truncate">{item.description}</p>
                                </div>
                                {isActive && <ChevronRight className={`w-4 h-4 shrink-0 ${ac.text}`} />}
                            </Link>
                        );
                    })}
                </nav>

                {/* ── CONTENT ── */}
                <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Section header */}
                    <div className={`flex items-center gap-3 mb-6 p-4 rounded-2xl border ${a.border} ${a.bg}`}>
                        <div className={`w-10 h-10 rounded-xl ${a.bg} border ${a.border} flex items-center justify-center shrink-0`}>
                            {(() => { const Icon = activeItem.icon; return <Icon className={`w-5 h-5 ${a.text}`} />; })()}
                        </div>
                        <div>
                            <h2 className={`text-lg font-black tracking-tight ${a.text}`}>{activeItem.label}</h2>
                            <p className="text-sm text-zinc-500">{activeItem.description}</p>
                        </div>
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
                            <div className="pt-8 border-t border-white/5">
                                <MetamobSettingsClient guildId={guildId} />
                            </div>
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
                    {activeTab === "membres" && (
                        <div className="space-y-8">
                            <MemberStatsOverview stats={memberStats} />
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                                        <UserCheck className="w-4 h-4 text-violet-400" />
                                        Gestion Manuelle
                                    </h3>
                                    <p className="text-sm text-zinc-500">Contrôle direct sur l&apos;archivage et les bannissements SigilOS.</p>
                                </div>
                                <MemberManagementTable
                                    initialMembers={members as never}
                                    guildId={guildId}
                                    welcomeBadgeName={welcomeBadgeName}
                                />
                            </div>

                            {/* [ADM-8] Comptes en suppression */}
                            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-4">
                                <DeletionPendingPanel guildId={guildId} />
                            </div>

                            <div className="max-w-4xl">
                                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                    <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-indigo-400" />
                                        Synchronisation Discord
                                    </h3>
                                    <p className="text-sm text-zinc-500 mb-4">Outil de secours en cas de désynchronisation constatée. La sync automatique tourne chaque nuit à 04:00.</p>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                                        <MemberSyncButton guildId={guildId} />
                                        <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Auto-sync: 04:00 AM</span>
                                    </div>
                                    <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                                        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-zinc-500 leading-relaxed">
                                            <span className="font-black text-amber-500 uppercase tracking-widest block mb-0.5">Fail-safe</span>
                                            SigilOS détecte automatiquement les arrivées et départs via les événements Discord. Utilisez ce bouton uniquement en cas de désynchronisation.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
