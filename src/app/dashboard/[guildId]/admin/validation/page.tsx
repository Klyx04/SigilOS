import { auth } from "@/auth";
import { getPendingSubmissions } from "@/server/actions/mission-actions";
import { getKamaDonations } from "@/server/actions/kama-actions";
import { getUserContext, internalUpdateMemberProfileStatus } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { AdminTourReplay } from "@/components/tour/admin-tour-replay";
import { Gavel, ScrollText, Coins, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ValidationQueue as MissionValidationQueue } from "@/components/missions/validation-queue";
import { KamaValidationQueue } from "@/components/kamas/kama-validation-queue";
import { ReactivationValidationQueue } from "@/components/admin/reactivation-validation-queue";
import { getPendingReactivations } from "@/server/actions/lifecycle-actions";
import { UserCheck } from "lucide-react";
import { getPendingAchievementSubmissions } from "@/server/actions/profile-actions";
import { AchievementValidationQueue } from "@/components/profile/achievement-validation-queue";

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

    // 🔒 LAZY CLEANUP: Trigger instant physical deletion of expired items (+24h)
    const { lazyCleanupExpiredSubmissions } = await import("@/server/actions/admin-actions");
    await lazyCleanupExpiredSubmissions(guildId).catch(() => {});

    // Parallel fetch all pending items
    const [missionRes, kamaRes, reactivationRes, achievementRes] = await Promise.all([
        getPendingSubmissions(guildId),
        getKamaDonations(guildId, { status: "PENDING", limit: 100 }),
        getPendingReactivations(guildId),
        getPendingAchievementSubmissions(guildId),
    ]);

    const missions = missionRes.success ? JSON.parse(JSON.stringify(missionRes.data)) : [];
    const kamaDonations = kamaRes.success ? JSON.parse(JSON.stringify(kamaRes.data ?? [])) : [];
    const reactivations = reactivationRes.success ? JSON.parse(JSON.stringify(reactivationRes.data ?? [])) : [];
    const achievements = achievementRes.success ? JSON.parse(JSON.stringify(achievementRes.data ?? [])) : [];

    const defaultTab = tab === "kamas" ? "kamas" : tab === "retours" ? "retours" : tab === "succes" ? "succes" : "missions";

    const totalPending = (missions?.length ?? 0) + kamaDonations.length + reactivations.length + achievements.length;

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="admin-validation-header">
                <UnifiedModuleHeader
                    title="Centre de Validation"
                    description={`Gérez toutes les preuves soumises par les membres. ${totalPending > 0 ? `${totalPending} en attente.` : "Tout est à jour ✓"}`}
                    icon={Gavel}
                    iconColor="#f59e0b"
                    backHref={`/dashboard/${guildId}`}
                    actions={<AdminTourReplay phase="adminValidation" />}
                />
            </div>

            <div data-tour="admin-validation-inbox">
                <Tabs defaultValue={defaultTab} className="space-y-6 min-h-[600px]">
                <div className="overflow-x-auto no-scrollbar pb-1">
                    <TabsList className="bg-zinc-900/50 border border-white/5 p-1 h-12 rounded-xl inline-flex min-w-full sm:min-w-0">
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
                            value="succes"
                            className="rounded-lg px-6 data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400 gap-2"
                        >
                            <Trophy className="w-4 h-4" />
                            Succès
                            {achievements.length > 0 && (
                                <Badge variant="secondary" className="ml-1 bg-sky-500/20 text-sky-400 border-sky-500/20 h-5 px-1.5 min-w-[20px] justify-center">
                                    {achievements.length}
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

                        <TabsTrigger
                            value="retours"
                            className="rounded-lg px-6 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 gap-2"
                        >
                            <UserCheck className="w-4 h-4" />
                            Retours
                            {reactivations.length > 0 && (
                                <Badge variant="secondary" className="ml-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/20 h-5 px-1.5 min-w-[20px] justify-center">
                                    {reactivations.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <TabsContent value="missions" className="outline-none m-0">
                        <MissionValidationQueue submissions={missions ?? []} guildId={guildId} />
                    </TabsContent>

                    <TabsContent value="succes" className="outline-none m-0">
                        <AchievementValidationQueue submissions={achievements} guildId={guildId} />
                    </TabsContent>

                    <TabsContent value="kamas" className="outline-none m-0">
                        <KamaValidationQueue donations={kamaDonations} guildId={guildId} />
                    </TabsContent>

                    <TabsContent value="retours" className="outline-none m-0">
                        <ReactivationValidationQueue requests={reactivations} guildId={guildId} />
                    </TabsContent>
                </div>
                </Tabs>
            </div>
        </div>
    );
}
