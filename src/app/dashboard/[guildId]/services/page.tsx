import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getServiceListings } from "@/server/actions/service-actions";
import { getLoans } from "@/server/actions/loan-actions";
import { getVaultEntries, getVaultBalance } from "@/server/actions/vault-actions";
import { getServicesStatusPublic } from "@/server/actions/admin-actions";
import { PassagesClient } from "./_components/passages-client";
import { db } from "@/lib/prisma";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";
import { ConciergeBell } from "lucide-react";


export default async function ServicesPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewServices) {
        return <AccessDenied />;
    }

    const isAdmin = user.isAdmin;
    if (!isAdmin && !await isModuleEnabled(guildId, "services")) {
        redirect(`/dashboard/${guildId}`);
    }

    // Fetch all data in parallel
    const [listingsRes, loansRes, vaultRes, vaultBalanceRes, statusRes, guildConfig] = await Promise.all([
        getServiceListings(guildId),
        getLoans(guildId),
        getVaultEntries(guildId),
        getVaultBalance(guildId),
        getServicesStatusPublic(guildId),
        db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { loansNotifyChannelId: true, servicesNotifyChannelId: true, vaultNotifyChannelId: true },
        }),
    ]);

    const servicesDiscordConfigured = !!guildConfig?.servicesNotifyChannelId;
    const loansDiscordConfigured = !!guildConfig?.loansNotifyChannelId;
    const vaultDiscordConfigured = !!guildConfig?.vaultNotifyChannelId;

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="services-header">
                <UnifiedModuleHeader
                    title="Services & Artisans"
                    description="Commandez des services, empruntez du kamas et gérez la banque de guilde."
                    icon={ConciergeBell}
                    iconColor="#06b6d4"
                    backHref={`/dashboard/${guildId}`}
                    actions={<ModuleTourReplayButton phase="services" />}
                />
            </div>

            <div data-tour="services-board">
                <PassagesClient
                    guildId={guildId}
                    profileId={user.profileId || undefined}
                    isAdmin={isAdmin}
                    canCreate={user.canViewServices}
                    listings={listingsRes.success ? JSON.parse(JSON.stringify(listingsRes.data || [])) : []}
                    loans={loansRes.success ? JSON.parse(JSON.stringify(loansRes.data || [])) : []}
                    vaultEntries={vaultRes.success ? JSON.parse(JSON.stringify(vaultRes.data || [])) : []}
                    vaultSummary={vaultBalanceRes.success ? JSON.parse(JSON.stringify(vaultBalanceRes.data || [])) : []}
                    maintenance={statusRes.success ? JSON.parse(JSON.stringify(statusRes.data)) : undefined}
                    servicesDiscordConfigured={servicesDiscordConfigured}
                    loansDiscordConfigured={loansDiscordConfigured}
                    vaultDiscordConfigured={vaultDiscordConfigured}
                />
            </div>
        </div>
    );
}

