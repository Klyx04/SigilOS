import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { Settings, Bell, Key, Moon, Users, Calendar, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobSettingsClient } from "../archimonstres/_components/metamob-settings-client";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";
import { CalendarSettingsClient } from "../calendar/_components/calendar-settings-client";
import { BonusSettingsClient } from "@/components/admin/bonus-settings-client";
import { MemberSyncButton } from "@/components/admin/member-sync-button";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { DofusSettingsClient } from "@/components/admin/dofus-settings-client";
import { Sword } from "lucide-react";

export default async function FeatureSettingsPage({
    params
}: {
    params: Promise<{ guildId: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Verify admin access + Audit Log
    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        await logAdminAccessDenied(guildId, "/admin/settings");
        return <AccessDenied />;
    }

    return (
        <div className="space-y-8 pb-12 w-full max-w-[1600px] mx-auto">
            <UnifiedModuleHeader
                title="Paramètres de Guilde"
                description="Configuration des fonctionnalités avancées"
                icon={Settings}
                backHref={`/dashboard/${guildId}/admin`}
            />

            {/* Custom "Command Deck" Tabs */}
            <Tabs defaultValue="absences" className="space-y-8">
                <div className="sticky top-[80px] z-30 bg-[#030304]/80 backdrop-blur-md py-4 border-b border-white/5 -mx-4 px-4 md:px-0 md:mx-0 md:border-b-0 md:bg-transparent md:backdrop-blur-none md:static">
                    <TabsList className="w-full h-auto p-1 bg-zinc-900/50 backdrop-blur-sm border border-white/10 rounded-2xl flex justify-start overflow-x-auto no-scrollbar gap-1 custom-scrollbar-hide">
                        <TabsTrigger
                            value="absences"
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_20px_rgba(34,211,238,0.1)] border border-transparent data-[state=active]:border-cyan-500/20"
                        >
                            <Bell className="h-4 w-4" />
                            <span className="font-bold tracking-wide">Absences</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="metamob"
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:shadow-[0_0_20px_rgba(251,191,36,0.1)] border border-transparent data-[state=active]:border-amber-500/20"
                        >
                            <Key className="h-4 w-4" />
                            <span className="font-bold tracking-wide">Metamob</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="songes"
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 data-[state=active]:shadow-[0_0_20px_rgba(168,85,247,0.1)] border border-transparent data-[state=active]:border-purple-500/20"
                        >
                            <Moon className="h-4 w-4" />
                            <span className="font-bold tracking-wide">Songes</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="membres"
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:shadow-[0_0_20px_rgba(16,185,129,0.1)] border border-transparent data-[state=active]:border-emerald-500/20"
                        >
                            <Users className="h-4 w-4" />
                            <span className="font-bold tracking-wide">Membres</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="calendrier"
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:shadow-[0_0_20px_rgba(251,191,36,0.1)] border border-transparent data-[state=active]:border-amber-500/20"
                        >
                            <Calendar className="h-4 w-4" />
                            <span className="font-bold tracking-wide">Calendrier</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="dofus"
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-400 data-[state=active]:shadow-[0_0_20px_rgba(99,102,241,0.1)] border border-transparent data-[state=active]:border-indigo-500/20"
                        >
                            <Sword className="h-4 w-4" />
                            <span className="font-bold tracking-wide">Dofus</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="bonus"
                            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 data-[state=active]:shadow-[0_0_20px_rgba(168,85,247,0.1)] border border-transparent data-[state=active]:border-purple-500/20"
                        >
                            <Sparkles className="h-4 w-4" />
                            <span className="font-bold tracking-wide">Bonus</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Absences Tab */}
                <TabsContent value="absences" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Gestion des Absences</h2>
                            <p className="text-zinc-400 max-w-2xl">Connectez un salon Discord pour automatiser le suivi des congés de vos membres. Le bot postera automatiquement un message récapitulatif.</p>
                        </div>
                        <AbsenceSettingsClient guildId={guildId} />
                    </div>
                </TabsContent>

                {/* Metamob Tab */}
                <TabsContent value="metamob" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Intégration Metamob</h2>
                            <p className="text-zinc-400 max-w-2xl">Configurez une clé API Metamob unique pour synchroniser l'état des Archimonstres de toute la guilde.</p>
                        </div>
                        <div className="max-w-4xl">
                            <MetamobSettingsClient guildId={guildId} />
                        </div>
                    </div>
                </TabsContent>

                {/* Songes Tab */}
                <TabsContent value="songes" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Notifications Songes</h2>
                            <p className="text-zinc-400 max-w-2xl">Recevez des alertes en temps réel sur Discord lorsqu'un membre postule à une run Songes Infinis.</p>
                        </div>
                        <SongesSettingsClientEmbed guildId={guildId} />
                    </div>
                </TabsContent>

                {/* Membres Tab */}
                <TabsContent value="membres" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Gestion des Membres</h2>
                            <p className="text-zinc-400 max-w-2xl">Outils de maintenance pour la base de données des membres.</p>
                        </div>
                        <div className="max-w-4xl space-y-6">
                            <div className="p-8 rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-400" />
                                    Synchronisation Discord
                                </h3>
                                <p className="text-sm text-zinc-400 mb-6 leading-relaxed max-w-xl">
                                    Compare les membres du serveur Discord avec les profils en base de données.
                                    Archive automatiquement les profils des membres ayant quitté, et réactive
                                    ceux qui reviennent.
                                </p>
                                <div className="flex items-center gap-4">
                                    <MemberSyncButton guildId={guildId} />
                                    <span className="text-xs text-zinc-500 font-mono">Auto-sync: 04:00 AM</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Calendrier Tab */}
                <TabsContent value="calendrier" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Notifications Calendrier</h2>
                            <p className="text-zinc-400 max-w-2xl">Partagez vos événements de guilde directement sur Discord avec un embed riche.</p>
                        </div>
                        <div className="max-w-4xl">
                            <CalendarSettingsClient guildId={guildId} />
                        </div>
                    </div>
                </TabsContent>

                {/* Dofus Tab */}
                <TabsContent value="dofus" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Configuration Dofus Unity</h2>
                            <p className="text-zinc-400 max-w-2xl">Paramétrez les informations relatives à Dofus pour l'ensemble de la guilde.</p>
                        </div>
                        <DofusSettingsClient guildId={guildId} />
                    </div>
                </TabsContent>

                {/* Bonus Tab */}
                <TabsContent value="bonus" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Notifications Bonus</h2>
                            <p className="text-zinc-400 max-w-2xl">Configurez le salon Discord où seront publiées les annonces d&apos;achat de bonus de guilde.</p>
                        </div>
                        <BonusSettingsClient guildId={guildId} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Simplified version of SongesSettingsClient for embedding (without back arrow)
function SongesSettingsClientEmbed({ guildId }: { guildId: string }) {
    return (
        <div className="max-w-4xl">
            {/* Re-use the Songes settings component but it has its own layout */}
            <SongesSettingsClient guildId={guildId} />
        </div>
    );
}
