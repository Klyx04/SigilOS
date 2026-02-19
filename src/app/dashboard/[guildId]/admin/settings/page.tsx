import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { Settings, Bell, Key, Moon, Users, Calendar, Sword, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobSettingsClient } from "../archimonstres/_components/metamob-settings-client";
import { MetamobUnlocker } from "../archimonstres/_components/metamob-unlocker";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";
import { CalendarSettingsClient } from "../calendar/_components/calendar-settings-client";
import { MissionSettingsClient } from "../_components/mission-settings-client";
import { MemberSyncButton } from "@/components/admin/member-sync-button";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { DofusSettingsClient } from "@/components/admin/dofus-settings-client";
import { MemberStatsOverview } from "@/components/admin/member-stats-overview";
import { MemberManagementTable } from "@/components/admin/member-management-table";
import { getGuildMemberStats, getGuildMembers } from "@/server/actions/user-actions";
import { ShieldAlert, UserCheck, BarChart3 } from "lucide-react";
import { PollSettingsClient } from "../_components/poll-settings-client";

// ============================================================================
// TAB STYLES
// ============================================================================

const TAB_STYLE = "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-semibold border border-transparent";

const TABS = {
    absences: `${TAB_STYLE} data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400 data-[state=active]:border-cyan-500/20`,
    songes: `${TAB_STYLE} data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 data-[state=active]:border-purple-500/20`,
    calendrier: `${TAB_STYLE} data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400 data-[state=active]:border-green-500/20`,
    metamob: `${TAB_STYLE} data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/20`,
    dofus: `${TAB_STYLE} data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-400 data-[state=active]:border-indigo-500/20`,
    missions: `${TAB_STYLE} data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/20`,
    membres: `${TAB_STYLE} data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20`,
    sondages: `${TAB_STYLE} data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400 data-[state=active]:border-cyan-500/20`,
};

// ============================================================================
// PAGE
// ============================================================================

export default async function FeatureSettingsPage({
    params
}: {
    params: Promise<{ guildId: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        await logAdminAccessDenied(guildId, "/admin/settings");
        return <AccessDenied />;
    }

    const memberStats = await getGuildMemberStats(guildId);
    const members = await getGuildMembers(guildId);

    return (
        <div className="space-y-8 pb-12 w-full max-w-[1600px] mx-auto">
            <UnifiedModuleHeader
                title="Paramètres"
                description="Intégrations Discord, Metamob, Dofus et gestion des membres"
                icon={Settings}
                backHref={`/dashboard/${guildId}/admin`}
            />

            <Tabs defaultValue="absences" className="space-y-8">
                {/* Tab bar — sticky */}
                <TabsList className="w-full h-auto p-1.5 bg-zinc-900/60 border border-white/8 rounded-2xl flex flex-wrap items-center gap-1">
                    {/* Groupe: Discord */}
                    <TabsTrigger value="absences" className={TABS.absences}>
                        <Bell className="h-3.5 w-3.5" />
                        Absences
                    </TabsTrigger>
                    <TabsTrigger value="songes" className={TABS.songes}>
                        <Moon className="h-3.5 w-3.5" />
                        Songes
                    </TabsTrigger>
                    <TabsTrigger value="calendrier" className={`${TABS.calendrier} mr-3`}>
                        <Calendar className="h-3.5 w-3.5" />
                        Calendrier
                    </TabsTrigger>

                    {/* Groupe: Intégrations */}
                    <TabsTrigger value="metamob" className={TABS.metamob}>
                        <Key className="h-3.5 w-3.5" />
                        Metamob
                    </TabsTrigger>
                    <TabsTrigger value="dofus" className={`${TABS.dofus} mr-3`}>
                        <Sword className="h-3.5 w-3.5" />
                        Dofus
                    </TabsTrigger>

                    {/* Groupe: Membres */}
                    <TabsTrigger value="membres" className={TABS.membres}>
                        <Users className="h-3.5 w-3.5" />
                        Membres & Sync
                    </TabsTrigger>

                    <TabsTrigger value="missions" className={TABS.missions}>
                        <Target className="h-3.5 w-3.5" />
                        Missions
                    </TabsTrigger>
                    <TabsTrigger value="sondages" className={TABS.sondages}>
                        <BarChart3 className="h-3.5 w-3.5" />
                        Sondages
                    </TabsTrigger>
                </TabsList>

                {/* ── Absences ── */}
                <TabsContent value="absences" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-6">
                        <SectionHeader
                            title="Gestion des Absences"
                            description="Connectez un salon Discord pour automatiser le suivi des congés. Le bot postera un message récapitulatif à chaque déclaration."
                        />
                        <AbsenceSettingsClient guildId={guildId} />
                    </div>
                </TabsContent>

                {/* ── Songes ── */}
                <TabsContent value="songes" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-6">
                        <SectionHeader
                            title="Notifications Songes"
                            description="Recevez des alertes Discord en temps réel lorsqu'un membre postule à une run Songes Infinis."
                        />
                        <div className="max-w-4xl">
                            <SongesSettingsClient guildId={guildId} />
                        </div>
                    </div>
                </TabsContent>

                {/* ── Calendrier ── */}
                <TabsContent value="calendrier" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-6">
                        <SectionHeader
                            title="Notifications Calendrier"
                            description="Partagez vos événements de guilde directement sur Discord avec un embed riche et automatique."
                        />
                        <div className="max-w-4xl">
                            <CalendarSettingsClient guildId={guildId} />
                        </div>
                    </div>
                </TabsContent>

                {/* ── Metamob ── */}
                <TabsContent value="metamob" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-6">
                        <SectionHeader
                            title="Intégration Metamob"
                            description="Configurez une clé API Metamob pour synchroniser l'état des Archimonstres de toute la guilde automatiquement."
                        />
                        <MetamobSettingsClient guildId={guildId} />
                        <div className="pt-6 border-t border-white/5 max-w-4xl">
                            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-400" />
                                Zone de Maintenance
                            </h3>
                            <p className="text-sm text-zinc-500 mb-4">Outils de dépannage pour les cas particuliers.</p>
                            <MetamobUnlocker guildId={guildId} />
                        </div>
                    </div>
                </TabsContent>

                {/* ── Dofus ── */}
                <TabsContent value="dofus" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-6">
                        <SectionHeader
                            title="Configuration Dofus Unity"
                            description="Paramétrez le serveur de jeu et les rangs autorisés pour les missions de la guilde."
                        />
                        <DofusSettingsClient guildId={guildId} />
                    </div>
                </TabsContent>

                {/* ── Membres ── */}
                <TabsContent value="membres" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-8">
                        <SectionHeader
                            title="Membres & Synchronisation"
                            description="Surveillance en temps réel, gestion manuelle et synchronisation avec Discord."
                        />
                        <MemberStatsOverview stats={memberStats} />

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                                    <UserCheck className="w-4 h-4 text-violet-400" />
                                    Gestion Manuelle
                                </h3>
                                <p className="text-sm text-zinc-500">Contrôle direct sur l'archivage et les bannissements SigilOS.</p>
                            </div>
                            <MemberManagementTable initialMembers={members as never} guildId={guildId} />
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
                </TabsContent>

                {/* ── Missions ── */}
                <TabsContent value="missions" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-6">
                        <SectionHeader
                            title="Notifications Missions"
                            description="Configurez l'annonce automatique des missions hebdomadaires sur votre serveur Discord."
                        />
                        <div className="max-w-4xl">
                            <MissionSettingsClient guildId={guildId} />
                        </div>
                    </div>
                </TabsContent>

                {/* ── Sondages ── */}
                <TabsContent value="sondages" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col gap-6">
                        <SectionHeader
                            title="Réglages des Sondages"
                            description="Configurez les intégrations Discord pour vos sondages et la gestion du rôle Micro."
                        />
                        <div className="max-w-4xl">
                            <PollSettingsClient guildId={guildId} />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function SectionHeader({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <h2 className="text-xl font-black tracking-tight text-white mb-1">{title}</h2>
            <p className="text-sm text-zinc-400 max-w-2xl">{description}</p>
        </div>
    );
}
