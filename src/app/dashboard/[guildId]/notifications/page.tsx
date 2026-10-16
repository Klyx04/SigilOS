import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { NotificationsClient } from "./_components/notifications-client";

interface NotificationsPageProps {
    params: Promise<{ guildId: string }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    // Auth & appartenance à la guilde
    if (!user.isAuthenticated || !user.isMember) {
        return <AccessDenied />;
    }

    return <NotificationsClient guildId={guildId} />;
}
