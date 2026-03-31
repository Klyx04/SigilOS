import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { AbsenceSettingsClient } from "./_components/absence-settings-client";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Bell } from "lucide-react";

export default async function AbsenceSettingsPage({
    params
}: {
    params: Promise<{ guildId: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Verify permission
    const user = await getUserContext(guildId);
    if (!user.canManageRelance) {
        await logAdminAccessDenied(guildId, "/admin/absence");
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Notifications Absences"
                description="Configurez les notifications Discord pour les absences des membres."
                imageSrc="/assets/ui/icons/calendar.png"
                backHref={`/dashboard/${guildId}/admin/settings`}
            />
            <AbsenceSettingsClient guildId={guildId} />
        </div>
    );
}
