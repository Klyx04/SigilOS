import { CalendarClock } from "lucide-react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getScheduledPolls } from "@/server/actions/scheduled-poll-actions";
import { ScheduledPollBoard } from "@/components/sondages/programmes/scheduled-poll-board";
import { ScheduledPollSettingsClient } from "../_components/scheduled-poll-settings-client";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";
import AccessDenied from "@/components/access-denied";

/**
 * **Sondages programmés** — module **staff**, qui vit dans le **Centre de
 * contrôle** (`/admin`), pas dans la navigation des membres.
 *
 * C'est la permission RBAC `staff:scheduled_polls` qui ouvre l'accès : un rôle
 * qui la détient voit le bouton « Staff » de la sidebar, la carte du module dans
 * `/admin`, **et** peut éditer ici les réglages (salon de l'embed, rôles de ping
 * autorisés, durée par défaut) **et** les créneaux.
 *
 * Triple garde, dans cet ordre : `canSchedulePolls` (permission **et** module
 * effectif — verrous God plateforme/guilde compris), entrée du God plateforme,
 * puis le module lui-même : un module coupé ne laisse **aucun** accès, même par
 * URL directe.
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
                backHref={`/dashboard/${guildId}/admin`}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <ModuleHelpActions
                            docSlug="admin-sondages-programmes"
                            docTitle="Sondages programmés"
                        />
                    </div>
                }
            />

            {/* Réglages du module (mêmes réglages que l'encart de Paramètres → Sondages,
                un seul composant partagé : aucune règle dupliquée). */}
            <ScheduledPollSettingsClient guildId={guildId} />

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
