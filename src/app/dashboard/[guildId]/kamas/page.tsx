import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getKamaDonations, getKamaStats, getKamaLadder } from "@/server/actions/kama-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Coins } from "lucide-react";
import AccessDenied from "@/components/access-denied";
import { KamasPageClient } from "./_components/kamas-page-client";

export const dynamic = "force-dynamic";

export default async function KamasPage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember) return <AccessDenied />;

    const canReview = user.canManageMissions || user.isAdmin;

    const [donationsRes, statsRes, ladderRes] = await Promise.all([
        getKamaDonations(guildId, { limit: 50 }),
        getKamaStats(guildId),
        getKamaLadder(guildId, "alltime"),
    ]);

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Dons de Kamas"
                description="Suivez et déclarez vos contributions kamas à la guilde."
                icon={Coins}
                iconColor="#f59e0b"
                backHref={`/dashboard/${guildId}`}
            />

            <KamasPageClient
                guildId={guildId}
                initialDonations={donationsRes.data || []}
                initialStats={statsRes.data || { totalValidated: 0, totalPending: 0, donorCount: 0, weeklyTotal: 0, weeklyPending: 0 }}
                initialLadder={ladderRes.data || []}
                canReview={canReview}
                currentProfileId={user.profileId || undefined}
            />
        </div>
    );
}
