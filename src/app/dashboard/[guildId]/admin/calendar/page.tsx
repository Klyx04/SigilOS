import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { CalendarSettingsClient } from "./_components/calendar-settings-client";

interface CalendarAdminPageProps {
    params: Promise<{ guildId: string }>;
}

export default async function CalendarAdminPage({ params }: CalendarAdminPageProps) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    // RBAC: Seul un admin ou un gestionnaire de calendrier peut accéder
    if (!user.isAdmin && !user.canManageCalendar) {
        return <AccessDenied />;
    }

    // 🔒 Verrou de module (guilde ∪ plateforme) + toggle admin
    if (!user.isSuperAdmin) {
        const { isModuleLocked, isModuleEnabled } = await import("@/server/actions/module-actions");
        if (await isModuleLocked(guildId, "calendar")) redirect(`/dashboard/${guildId}`);
        if (!(await isModuleEnabled(guildId, "calendar"))) redirect(`/dashboard/${guildId}`);
    }

    return (
        <div className="container max-w-5xl py-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Notifications Calendrier</h1>
                <p className="text-muted-foreground mt-1">
                    Configurez le salon Discord où les événements seront partagés.
                </p>
            </div>

            <CalendarSettingsClient guildId={guildId} />
        </div>
    );
}
