import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildMembers } from "@/server/actions/profile-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { GuildAbsenceCalendar } from "@/components/directory/guild-absence-calendar";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { CalendarClock } from "lucide-react";
import AccessDenied from "@/components/access-denied";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function PlanningPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // RBAC : module Disponibilités (permission incluse) requis
    const user = await getUserContext(guildId);
    if (!user.canViewAvailability) {
        return <AccessDenied />;
    }

    // Garde-fou module : même un admin ne voit pas la page si le module est OFF
    // (le `bypass` de getUserContext s'applique aux pages internes, pas à celle-ci).
    const [moduleEnabled, membersRes] = await Promise.all([
        isModuleEnabled(guildId, "availability"),
        getGuildMembers(guildId),
    ]);
    if (!moduleEnabled) return <AccessDenied />;

    if (!membersRes.success) {
        return <AccessDenied />;
    }

    const members = JSON.parse(JSON.stringify(membersRes.data || []));

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <div data-tour="planning-header">
                <UnifiedModuleHeader
                    title="Planning de Guilde"
                    description="Disponibilités et absences de tous les membres, semaine par semaine."
                    icon={CalendarClock}
                    iconColor="#34d399"
                    backHref={`/dashboard/${guildId}`}
                />
            </div>

            <div data-tour="planning-board">
                <GuildAbsenceCalendar
                    members={members}
                    guildId={guildId}
                    highlightProfileId={user.profileId || undefined}
                />
            </div>
        </div>
    );
}
