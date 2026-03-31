import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getServiceListings } from "@/server/actions/service-actions";
import { getLoans } from "@/server/actions/loan-actions";
import { getVaultEntries, getVaultBalance } from "@/server/actions/vault-actions";
import { getServicesStatusConfig } from "@/server/actions/admin-actions";
import { PassagesClient } from "./_components/passages-client";

export default async function PassagesPage({ params }: { params: Promise<{ guildId: string }> }) {
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
    const [listingsRes, loansRes, vaultRes, vaultBalanceRes, statusRes] = await Promise.all([
        getServiceListings(guildId),
        getLoans(guildId),
        getVaultEntries(guildId),
        getVaultBalance(guildId),
        getServicesStatusConfig(guildId),
    ]);

    return (
        <PassagesClient
            guildId={guildId}
            profileId={user.profileId || undefined}
            isAdmin={isAdmin}
            canCreate={user.canViewServices}
            listings={listingsRes.success ? (listingsRes.data || []) : []}
            loans={loansRes.success ? (loansRes.data || []) : []}
            vaultEntries={vaultRes.success ? (vaultRes.data || []) : []}
            vaultSummary={vaultBalanceRes.success ? (vaultBalanceRes.data || []) : []}
            maintenance={statusRes.success ? statusRes.data : undefined}
        />
    );
}

