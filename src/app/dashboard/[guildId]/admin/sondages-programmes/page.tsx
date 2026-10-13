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
 * `/admin`, **et** peut créer/modifier/annuler des créneaux ici.
 *
 * ⛔ **Un seul écran par réglage** (14/10/2026) : le salon de l'embed, les rôles de
 * ping autorisés et la durée de vote par défaut sont des réglages de **guilde** —
 * ils vivent dans `Paramètres → Sondages` (2ᵉ encart) et n'ont **pas** à être
 * répétés ici. Seule exception, mesurée : le rôle staff n'a pas `system:config`,
 * donc `Paramètres` lui est **fermé** (`canViewSettings`) ⇒ l'encart lui reste
 * affiché ici, et lui seul — jamais deux fois le même jour sur le même écran.
 * Le compteur de places, lui, est porté par le tableau.
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

            {/* Réglages du module : ils vivent dans « Paramètres → Sondages » (un seul
                écran par réglage), donc **rien** pour un admin. Mais le rôle staff n'a
                pas `system:config` : mesuré, `Paramètres` lui est fermé
                (`canViewSettings`) ⇒ on lui garde l'encart ici (même composant partagé,
                donc aucune règle dupliquée), et l'écran reste unique pour chacun. */}
            {!user.canViewSettings && <ScheduledPollSettingsClient guildId={guildId} />}

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
