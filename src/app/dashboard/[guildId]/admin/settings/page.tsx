import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { Settings, Bell, Key, Moon, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobSettingsClient } from "../archimonstres/_components/metamob-settings-client";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";
import { MemberSyncButton } from "@/components/admin/member-sync-button";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";

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
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Paramètres de Guilde"
                description="Configuration des fonctionnalités avancées"
                icon={Settings}
                backHref={`/dashboard/${guildId}/admin`}
            />

            {/* Settings Tabs */}
            <Tabs defaultValue="absences" className="space-y-6">
                <TabsList className="bg-zinc-900/60 border border-white/5 h-auto flex-wrap">
                    <TabsTrigger value="absences" className="gap-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                        <Bell className="h-4 w-4" />
                        Notifications Discord Absences
                    </TabsTrigger>
                    <TabsTrigger value="metamob" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                        <Key className="h-4 w-4" />
                        Intégration Metamob
                    </TabsTrigger>
                    <TabsTrigger value="songes" className="gap-2 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                        <Moon className="h-4 w-4" />
                        Notifications Discord Songes
                    </TabsTrigger>
                    <TabsTrigger value="membres" className="gap-2 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                        <Users className="h-4 w-4" />
                        Gestion des Membres
                    </TabsTrigger>
                </TabsList>

                {/* Absences Tab */}
                <TabsContent value="absences" className="mt-6">
                    <AbsenceSettingsClient guildId={guildId} />
                </TabsContent>

                {/* Metamob Tab */}
                <TabsContent value="metamob" className="mt-6">
                    <MetamobSettingsClient guildId={guildId} />
                </TabsContent>

                {/* Songes Tab */}
                <TabsContent value="songes" className="mt-6">
                    <SongesSettingsClientEmbed guildId={guildId} />
                </TabsContent>

                {/* Membres Tab */}
                <TabsContent value="membres" className="mt-6">
                    <div className="max-w-4xl space-y-6">
                        <div className="p-6 rounded-xl bg-zinc-900/60 border border-white/5">
                            <h3 className="text-lg font-semibold text-white mb-4">Synchronisation Discord</h3>
                            <p className="text-sm text-zinc-400 mb-4">
                                Compare les membres du serveur Discord avec les profils en base de données.
                                Archive automatiquement les profils des membres ayant quitté, et réactive
                                ceux qui reviennent.
                            </p>
                            <MemberSyncButton guildId={guildId} />
                        </div>

                        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <p className="text-sm text-amber-400">
                                <strong>Note :</strong> En production, cette synchronisation s'exécute
                                automatiquement chaque jour à 4h du matin via un cron job.
                            </p>
                        </div>
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
