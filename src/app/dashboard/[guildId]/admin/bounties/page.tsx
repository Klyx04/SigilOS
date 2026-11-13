import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { BountiesClient } from "./_components/bounties-client";

interface BountiesAdminPageProps {
    params: Promise<{ guildId: string }>;
}

export default async function BountiesAdminPage({ params }: BountiesAdminPageProps) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    // Outil réservé à la plateforme / SuperAdmin (GOD MODE)
    if (!user.isSuperAdmin) {
        return <AccessDenied />;
    }

    return <BountiesClient guildId={guildId} />;
}
