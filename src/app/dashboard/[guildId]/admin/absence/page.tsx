import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import AccessDenied from "@/components/access-denied";
import { AbsenceSettingsClient } from "./_components/absence-settings-client";

export default async function AbsenceSettingsPage({
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

    return <AbsenceSettingsClient guildId={guildId} />;
}
