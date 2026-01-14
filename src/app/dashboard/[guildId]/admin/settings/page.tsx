import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import AccessDenied from "@/components/access-denied";
import { Settings, Bell, Key, Moon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbsenceSettingsClient } from "../absence/_components/absence-settings-client";
import { MetamobSettingsClient } from "../archimonstres/_components/metamob-settings-client";
import { SongesSettingsClient } from "../songes/_components/songes-settings-client";

export default async function FeatureSettingsPage({
    params
}: {
    params: Promise<{ guildId: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Verify admin access
    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        return <AccessDenied />;
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20">
                    <Settings className="h-8 w-8 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Paramètres
                    </h1>
                    <p className="text-muted-foreground">
                        Configuration des fonctionnalités de guilde
                    </p>
                </div>
            </div>

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
