import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildMembers, getUserProfile } from "@/server/actions/profile-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { GuildAbsenceCalendar } from "@/components/directory/guild-absence-calendar";
import { PlanningEditButton } from "@/components/directory/planning-edit-button";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { CalendarClock } from "lucide-react";
import AccessDenied from "@/components/access-denied";

import { ModuleHelpActions } from "@/components/doc/module-help-actions";

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
    const [moduleEnabled, membersRes, profileRes] = await Promise.all([
        isModuleEnabled(guildId, "availability"),
        getGuildMembers(guildId),
        getUserProfile(guildId),
    ]);
    if (!moduleEnabled) return <AccessDenied />;

    if (!membersRes.success) {
        return <AccessDenied />;
    }

    const members = JSON.parse(JSON.stringify(membersRes.data || []));
    // #132 — le bouton « Éditer mon planning » pré-charge la disponibilité du membre courant.
    const myAvailability = profileRes.success && profileRes.data
        ? (profileRes.data.availability as any)
        : null;
    const myVacationStart = profileRes.success && profileRes.data?.vacationStart ? new Date(profileRes.data.vacationStart) : null;
    const myVacationEnd = profileRes.success && profileRes.data?.vacationEnd ? new Date(profileRes.data.vacationEnd) : null;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div data-tour="planning-header" className="flex-1 min-w-0">
                    <UnifiedModuleHeader
                        title="Planning de Guilde"
                        description="Disponibilités et absences de tous les membres, semaine par semaine."
                        icon={CalendarClock}
                        iconColor="#34d399"
                        backHref={`/dashboard/${guildId}`}
                        actions={<ModuleHelpActions docSlug="planning" docTitle="Planning & Disponibilités" />}
                    />
                </div>
                <PlanningEditButton
                    guildId={guildId}
                    initialAvailability={myAvailability}
                    vacationStart={myVacationStart}
                    vacationEnd={myVacationEnd}
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
