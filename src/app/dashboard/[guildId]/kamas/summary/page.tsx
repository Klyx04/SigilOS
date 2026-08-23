import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getWeeklyKamaSummary } from "@/server/actions/kama-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Coins } from "lucide-react";
import AccessDenied from "@/components/access-denied";
import { KamaWeeklySummary } from "@/components/kamas/kama-weekly-summary";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getDofusWeek } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function KamaWeeklySummaryPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Module guard — missions doit être activé (le module kamas est lié aux missions)
    if (!await isModuleEnabled(guildId, "missions")) {
        redirect(`/dashboard/${guildId}`);
    }

    const user = await getUserContext(guildId);

    // Accessible à tous les membres authentifiés (COMMUNITY_ACCESS minimum)
    // Les officiers voient en plus les preuves screenshots
    if (!user.isAuthenticated || !user.isMember || !user.canViewMissions) {
        return <AccessDenied />;
    }

    const isOfficer = user.canManageMissions || user.isAdmin;

    const summaryRes = await getWeeklyKamaSummary(guildId);

    if (!summaryRes.success || !summaryRes.data) {
        return (
            <div className="space-y-6 pb-12">
                <UnifiedModuleHeader
                    title="Récap Kamas Semaine"
                    description="Erreur lors du chargement du récapitulatif."
                    icon={Coins}
                    iconColor="#f59e0b"
                    backHref={`/dashboard/${guildId}/kamas`}
                />
                <div className="rounded-xl border border-danger/20 bg-danger/5 p-6 text-center text-sm text-danger">
                    {summaryRes.error || "Une erreur est survenue."}
                </div>
            </div>
        );
    }

    const { week, year } = getDofusWeek();

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Récap Kamas Semaine"
                description={`Semaine ${week} · ${year} — Dons validés & éligibilité aux raids officiels`}
                icon={Coins}
                iconColor="#f59e0b"
                backHref={`/dashboard/${guildId}/kamas`}
            />

            <KamaWeeklySummary
                data={summaryRes.data ? JSON.parse(JSON.stringify(summaryRes.data)) : undefined}
                isOfficer={isOfficer}
                guildId={guildId}
            />
        </div>
    );
}
