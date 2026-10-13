import { CalendarClock } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getScheduledPolls } from "@/server/actions/scheduled-poll-actions";
import { ScheduledPollBoard } from "@/components/sondages/programmes/scheduled-poll-board";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";

/**
 * **Sondages programmés** (module staff `scheduledPolls`).
 *
 * Triple garde, dans cet ordre : `canSchedulePolls` (permission
 * `staff:scheduled_polls` **et** module effectif — verrous God compris),
 * l'entrée du God plateforme, puis le module lui-même. Un module coupé ne
 * laisse donc **aucun** accès à la page, même par URL directe.
 */
export default async function ScheduledPollsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canSchedulePolls && !user.isSuperAdmin) {
        return <AccessDenied />;
    }

    if (!user.isSuperAdmin && !await isModuleEnabled(guildId, "scheduledPolls")) {
        redirect(`/dashboard/${guildId}`);
    }

    const result = await getScheduledPolls(guildId);

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Sondages programmés"
                description="Programmez un sondage (date, heure et minute) : il partira automatiquement dans le salon choisi, avec les mêmes options et la même fiche que les sondages classiques."
                icon={CalendarClock}
                iconColor="#06b6d4"
                backHref={`/dashboard/${guildId}`}
            />

            {!result.success || !result.data ? (
                <div className="p-4 rounded-lg border border-warning/30 bg-warning/10 text-sm text-warning">
                    {result.error || "Impossible de charger les créneaux."}
                </div>
            ) : (
                <ScheduledPollBoard guildId={guildId} board={result.data} />
            )}
        </div>
    );
}
