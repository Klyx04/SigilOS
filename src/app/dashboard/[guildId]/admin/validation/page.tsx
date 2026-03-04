import { auth } from "@/auth";
import { getPendingSubmissions } from "@/server/actions/mission-actions";
import { getPendingAchievements } from "@/server/actions/achievement-actions";
import { getKamaDonations } from "@/server/actions/kama-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Gavel, ScrollText, Trophy, Coins } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ValidationQueue as MissionValidationQueue } from "@/components/missions/validation-queue";
import { AchievementValidationQueue } from "@/components/ladder/achievement-validation-queue";
import { KamaValidationQueue } from "@/components/kamas/kama-validation-queue";

export const dynamic = "force-dynamic";

export default async function UnifiedValidationPage({
    params,
    searchParams
}: {
    params: Promise<{ guildId: string }>,
    searchParams: Promise<{ tab?: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");
    const { guildId } = await params;
    const { tab } = await searchParams;

    const user = await getUserContext(guildId);

    if (!user.canValidateMissions && !user.isAdmin) {
        await logAdminAccessDenied(guildId, "/admin/validation");
        return <AccessDenied />;
    }

    // Parallel fetch all pending items
    const [missionRes, achievementRes, kamaRes] = await Promise.all([
        getPendingSubmissions(guildId),
        getPendingAchievements(guildId),
        getKamaDonations(guildId, { status: "PENDING", limit: 100 }),
    ]);

    const missions = missionRes.success ? missionRes.data : [];
    const achievements = achievementRes.success ? achievementRes.data : [];
    const kamaDonations = kamaRes.success ? kamaRes.data ?? [] : [];

    const defaultTab = tab === "achievements" ? "achievements" : tab === "kamas" ? "kamas" : "missions";

    const totalPending = (missions?.length ?? 0) + (achievements?.length ?? 0) + kamaDonations.length;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Centre de Validation"
                description={`Gérez toutes les preuves soumises par les membres. ${totalPending > 0 ? `${totalPending} en attente.` : "Tout est à jour ✓"}`}
                icon={Gavel}
                iconColor="#f59e0b"
                backHref={`/dashboard/${guildId}`}
            />

            <Tabs defaultValue={defaultTab} className="space-y-6">
                <TabsList className="bg-zinc-900/50 border border-white/5 p-1 h-12 rounded-xl">
                    <TabsTrigger
                        value="missions"
                        className="rounded-lg px-6 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 gap-2"
                    >
                        <ScrollText className="w-4 h-4" />
                        Missions
                        {(missions?.length ?? 0) > 0 && (
                            <Badge variant="secondary" className="ml-1 bg-blue-500/20 text-blue-400 border-none h-5 px-1.5 min-w-[20px] justify-center">
                                {missions?.length}
                            </Badge>
                        )}
                    </TabsTrigger>

                    <TabsTrigger
                        value="achievements"
                        className="rounded-lg px-6 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 gap-2"
                    >
                        <Trophy className="w-4 h-4" />
                        Succès
                        {(achievements?.length ?? 0) > 0 && (
                            <Badge variant="secondary" className="ml-1 bg-amber-500/20 text-amber-400 border-none h-5 px-1.5 min-w-[20px] justify-center">
                                {achievements?.length}
                            </Badge>
                        )}
                    </TabsTrigger>

                    <TabsTrigger
                        value="kamas"
                        className="rounded-lg px-6 data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-300 gap-2"
                    >
                        <Coins className="w-4 h-4" />
                        Dons Kamas
                        {kamaDonations.length > 0 && (
                            <Badge variant="secondary" className="ml-1 bg-amber-600/20 text-amber-300 border-amber-500/20 h-5 px-1.5 min-w-[20px] justify-center">
                                {kamaDonations.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="missions" className="outline-none">
                    <MissionValidationQueue submissions={missions ?? []} guildId={guildId} />
                </TabsContent>

                <TabsContent value="achievements" className="outline-none">
                    <AchievementValidationQueue submissions={achievements ?? []} guildId={guildId} />
                </TabsContent>

                <TabsContent value="kamas" className="outline-none">
                    <KamaValidationQueue donations={kamaDonations} guildId={guildId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
